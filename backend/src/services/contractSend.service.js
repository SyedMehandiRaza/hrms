const crypto = require("crypto");
const { Op, UniqueConstraintError } = require("sequelize");
const { sequelize, Contract, ContractRecipient, ContractField, ContractActivity, FinancialYear, NumberSequence } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { translate } = require("../utils/i18n");
const { SUPPORTED_AUDIENCES, isRecipientActive, mainProjects } = require("./contractParties.service");
const { resolveMergeValues, valuesSha256 } = require("./contractMerge.service");
const { companyTimezone, todayIn, endOfDayUtc } = require("../utils/companyTime");
const { lockContract, termErrors, contractItem, ITEM_INCLUDE } = require("./contract.service");

// Sending (plan decisions 23–25, 35, 41). Per contract, one transaction:
//   lock the draft → recipient active → terms valid → number (sequence row locked) and
//   sent_at → merge values frozen + values_sha256 → required values present → no other
//   active contract of the type → SENT, expiry, project, SENT activity.
// A block rolls everything back (the number too) and is then recorded on the draft as
// meta.block = { code, params? }. Notifications go out after commit (ticket 14).

// A business block: the contract stays DRAFT with this reason.
class SendBlocked extends Error {
  constructor(code, params) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

// The company's OPEN financial year containing `today`, or null (decision 24).
const openYear = (employerId, today, transaction) =>
  FinancialYear.findOne({
    where: { employer_id: employerId, status: "OPEN", start_date: { [Op.lte]: today }, end_date: { [Op.gte]: today } },
    transaction,
  });

const assertOpenYear = async ({ employerId, today }) => {
  if (!(await openYear(employerId, today))) throw new ErrorHandler("CONTRACT_NO_OPEN_FY");
};

// Creates the year's CONTRACT sequence row if missing: an insert that does nothing when it
// exists, run on its own (auto-commit) so concurrent first sends never deadlock on it.
const ensureSequence = (employerId, year) =>
  sequelize.query(
    "INSERT IGNORE INTO hrms_number_sequences (id, employer_id, doc_type, financial_year_id, last_no, created_at, updated_at) " +
      "VALUES (?, ?, 'CONTRACT', ?, 0, NOW(), NOW())",
    { replacements: [crypto.randomUUID(), employerId, year.id] }
  );

// Next CON-<FY start year>-<0001> number; the sequence row stays locked FOR UPDATE until
// the send commits, so a failed send gives its number back (decision 24).
const nextNumber = async (employerId, year, transaction) => {
  const seq = await NumberSequence.findOne({
    where: { employer_id: employerId, doc_type: "CONTRACT", financial_year_id: year.id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const next = seq.last_no + 1;
  await seq.update({ last_no: next }, { transaction });
  return `CON-${year.year_key}-${String(next).padStart(4, "0")}`;
};

const activeContractNumber = async (contract, transaction) => {
  const other = await Contract.findOne({
    where: {
      employer_id: contract.employer_id,
      contract_type_id: contract.contract_type_id,
      recipient_key: contract.recipient_key,
      status: { [Op.in]: ["SENT", "VIEWED", "SUBMITTED"] },
      id: { [Op.ne]: contract.id },
    },
    attributes: ["reference_no"],
    transaction,
  });
  return other ? other.reference_no : null;
};

const recipientIdOf = (recipient) => recipient.employee_id || recipient.staffing_company_id;

// The send itself; throws SendBlocked, ErrorHandler (whole-request problems) or anything else.
const sendInTransaction = async (auth, id, transaction) => {
  const { employerId, userId } = auth;
  const c = await lockContract(employerId, id, transaction);
  if (c.status !== "DRAFT") throw new ErrorHandler("CONTRACT_STATUS_INVALID");
  if (!SUPPORTED_AUDIENCES.includes(c.audience_type)) throw new ErrorHandler("CONTRACT_AUDIENCE_UNSUPPORTED");
  const recipient = await ContractRecipient.findOne({ where: { contract_id: c.id }, transaction });
  const recipientId = recipientIdOf(recipient);

  if (!(await isRecipientActive(employerId, c.audience_type, recipientId, transaction))) throw new SendBlocked("CONTRACT_RECIPIENT_INACTIVE");

  const tz = await companyTimezone(employerId, transaction);
  const today = todayIn(tz);
  const signBy = c.meta?.sign_by;
  const errors = termErrors({ start_date: c.start_date, end_date: c.end_date, renewal_due: c.renewal_due, sign_by: signBy }, today);
  if (Object.keys(errors).length) throw new ErrorHandler("VALIDATION_FAILED", { errors });

  const year = await openYear(employerId, today, transaction);
  if (!year) throw new ErrorHandler("CONTRACT_NO_OPEN_FY");
  const seq = await NumberSequence.count({ where: { employer_id: employerId, doc_type: "CONTRACT", financial_year_id: year.id }, transaction });
  if (!seq) throw new NeedsSequence(year);
  const number = await nextNumber(employerId, year, transaction);
  const sentAt = new Date();

  const fields = await ContractField.findAll({ where: { contract_id: c.id }, transaction });
  const { values, missing } = await resolveMergeValues({
    employerId,
    audience: c.audience_type,
    recipientId,
    contract: { ...c.get({ plain: true }), reference_no: number, sent_at: sentAt },
    fields,
    transaction,
  });
  if (missing.length) throw new SendBlocked("CONTRACT_FIELD_MISSING", { fields: missing.join(", ") });

  const mergeFields = fields.filter((f) => f.field_type === "DB_COLUMN");
  for (const f of mergeFields) await f.update({ value: values.get(f.id), filled_at: sentAt }, { transaction });
  const hash = valuesSha256(mergeFields.map((f) => ({ id: f.id, field_type: f.field_type, value: values.get(f.id) })));

  const activeNo = await activeContractNumber(c, transaction);
  if (activeNo) throw new SendBlocked("CONTRACT_ACTIVE_EXISTS", { number: activeNo });

  const project = c.audience_type === "EMPLOYEE" ? (await mainProjects(employerId, [recipientId], transaction)).get(recipientId) : null;
  const expiresAt = endOfDayUtc(signBy, tz);
  const meta = { ...(c.meta || {}) };
  delete meta.block; // a successful send clears the last block reason
  try {
    await c.update(
      { status: "SENT", reference_no: number, sent_at: sentAt, expires_at: expiresAt, values_sha256: hash, project_id: project ? project.id : null, meta },
      { transaction }
    );
  } catch (err) {
    // A concurrent send for the same recipient and type won the unique active_key.
    if (err instanceof UniqueConstraintError) throw new SendBlocked("CONTRACT_ACTIVE_EXISTS", { number: "" });
    throw err;
  }
  await recipient.update({ status: "SENT", sent_at: sentAt }, { transaction });
  await ContractActivity.create(
    {
      employer_id: employerId,
      contract_id: c.id,
      recipient_id: recipient.id,
      action: "SENT",
      actor_user_id: userId,
      meta: { number, values_sha256: hash, expires_at: expiresAt.toISOString() },
    },
    { transaction }
  );
  return c;
};

const recordBlock = async (employerId, id, block) => {
  const c = await Contract.findOne({ where: { id, employer_id: employerId } });
  if (c && c.status === "DRAFT") await c.update({ meta: { ...(c.meta || {}), block } });
};

// A unique-key race doesn't know the winner's number until it has committed.
const resolveBlock = async (employerId, id, err) => {
  if (err.code === "CONTRACT_ACTIVE_EXISTS" && !err.params.number) {
    const c = await Contract.findByPk(id);
    err.params.number = (await activeContractNumber(c)) || "";
  }
  return err.params ? { code: err.code, params: err.params } : { code: err.code };
};

// The year's sequence row doesn't exist yet: create it outside the transaction, then retry.
class NeedsSequence extends Error {
  constructor(year) {
    super("sequence row missing");
    this.year = year;
  }
}

const isDeadlock = (err) => err?.parent?.code === "ER_LOCK_DEADLOCK" || err?.original?.code === "ER_LOCK_DEADLOCK";
const MAX_ATTEMPTS = 3;

// One send transaction, retried when it only needs the sequence row or lost a deadlock
// (MySQL rolls the loser back entirely, so retrying is safe).
const runSend = async (auth, id) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await sequelize.transaction((transaction) => sendInTransaction(auth, id, transaction));
    } catch (err) {
      if (err instanceof NeedsSequence && attempt < MAX_ATTEMPTS) {
        await ensureSequence(auth.employerId, err.year);
        continue;
      }
      if (isDeadlock(err) && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }
};

// Sends one draft. → { ok: true, contract } | { ok: false, block }. Whole-request errors throw.
const trySend = async (auth, id) => {
  try {
    const contract = await runSend(auth, id);
    return { ok: true, contract };
  } catch (err) {
    if (!(err instanceof SendBlocked)) throw err;
    const block = await resolveBlock(auth.employerId, id, err);
    await recordBlock(auth.employerId, id, block);
    return { ok: false, block };
  }
};

// Wizard row (decision 25): SENT, DRAFT with the block, or FAILED on an unexpected error.
const sendRow = (lang) => async (auth, id) => {
  try {
    const { ok, block } = await trySend(auth, id);
    if (ok) return { contractId: id, result: "SENT" };
    return { contractId: id, result: "DRAFT", code: block.code, message: translate(block.code, lang, block.params) };
  } catch (err) {
    if (err instanceof ErrorHandler && err.code !== "INTERNAL_ERROR") {
      return { contractId: id, result: "DRAFT", code: err.code, message: translate(err.code, lang, err.params) };
    }
    console.error("[contracts] sending a contract failed", { contractId: id, error: err.message });
    return { contractId: id, result: "FAILED", code: "INTERNAL_ERROR", message: translate("INTERNAL_ERROR", lang) };
  }
};

// POST /contracts/:id/send. A block answers with its own code (400/409); the draft keeps it.
const sendDraft = async (auth, id) => {
  const { ok, block } = await trySend(auth, id);
  if (!ok) throw new ErrorHandler(block.code, block.params ? { params: block.params } : {});
  return contractItem(await Contract.findByPk(id, { include: ITEM_INCLUDE }));
};

module.exports = { sendDraft, sendRow, assertOpenYear };
