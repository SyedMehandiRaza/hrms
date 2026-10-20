const { Op } = require("sequelize");
const {
  sequelize,
  Contract,
  ContractRecipient,
  ContractField,
  ContractActivity,
  ContractTemplate,
  ContractTemplateField,
  ContractType,
  Employee,
  StaffingCompany,
  User,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { translate } = require("../utils/i18n");
const { UUID } = require("./department.service");
const { SUPPORTED_AUDIENCES } = require("./contractParties.service");
const { companyTimezone, todayIn, addDays } = require("../utils/companyTime");
const { DEFAULT_CURRENCY } = require("../constants/currencies");

// Contracts written by HR (plan decisions 18–25): drafts (one per recipient), draft edits
// and deletes. Sending lives next to them (contractSend.service).

const MAX_RECIPIENTS = 200;
const SIGN_BY_DEFAULT_DAYS = 7;
const SIGN_BY_MAX_DAYS = 90;
const TERM_KEYS = ["name", "start_date", "end_date", "renewal_due", "sign_by", "rate", "rate_unit", "currency", "notice_period_days"];

const orNull = (v) => (v === undefined || v === "" ? null : v);
const money = (v) => (v === null || v === undefined ? null : Number(v).toFixed(2));

// Plain contract item (list rows and action results; detail adds more, ticket 23).
const contractItem = (c) => {
  const recipient = (c.contractRecipients || [])[0];
  return {
    id: c.id,
    number: c.reference_no,
    name: c.name,
    status: c.status,
    audience_type: c.audience_type,
    template_id: c.template_id,
    document_id: c.document_id,
    contract_type: c.contractType ? { id: c.contractType.id, name: c.contractType.name, code: c.contractType.code } : null,
    start_date: c.start_date,
    end_date: c.end_date,
    renewal_due: c.renewal_due,
    sign_by: c.meta?.sign_by ?? null,
    rate: money(c.rate),
    rate_unit: c.rate_unit,
    currency: c.currency,
    notice_period_days: c.notice_period_days,
    sent_at: c.sent_at,
    viewed_at: c.viewed_at,
    submitted_at: c.submitted_at,
    completed_at: c.completed_at,
    expires_at: c.expires_at,
    revoked_at: c.revoked_at,
    revoke_reason: c.revoke_reason,
    block: c.meta?.block ?? null,
    recipient: recipient
      ? {
          id: recipient.id,
          type: recipient.recipient_type,
          employee_id: recipient.employee_id,
          staffing_company_id: recipient.staffing_company_id,
          name: recipient.recipient_name,
          status: recipient.status,
        }
      : null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
};

const ITEM_INCLUDE = [
  { model: ContractType, as: "contractType" },
  { model: ContractRecipient, as: "contractRecipients" },
];

// ---------- terms ----------

// Checks the date rules that depend on each other or on today (decision 21). Returns an
// errors map; the formats were already checked by the schema.
const termErrors = (t, today) => {
  const errors = {};
  if (t.end_date && t.start_date && t.end_date < t.start_date) errors.end_date = "endDateBeforeStart";
  else if (t.end_date && t.end_date < today) errors.end_date = "endDatePast";
  if (t.renewal_due && ((t.start_date && t.renewal_due < t.start_date) || (t.end_date && t.renewal_due > t.end_date))) {
    errors.renewal_due = "renewalDueRange";
  }
  if (t.sign_by && (t.sign_by < addDays(today, 1) || t.sign_by > addDays(today, SIGN_BY_MAX_DAYS))) errors.sign_by = "signByRange";
  return errors;
};

const assertTerms = (t, today) => {
  const errors = termErrors(t, today);
  if (Object.keys(errors).length) throw new ErrorHandler("VALIDATION_FAILED", { errors });
};

// Body → stored terms (missing sign-by → today + 7; missing currency → SAR).
const normalizeTerms = (body, today) => ({
  name: orNull(body.name),
  start_date: body.start_date,
  end_date: orNull(body.end_date),
  renewal_due: orNull(body.renewal_due),
  sign_by: orNull(body.sign_by) || addDays(today, SIGN_BY_DEFAULT_DAYS),
  rate: orNull(body.rate),
  rate_unit: orNull(body.rate) === null ? null : orNull(body.rate_unit),
  currency: orNull(body.currency) || DEFAULT_CURRENCY,
  notice_period_days: orNull(body.notice_period_days),
});

const companyToday = async (employerId, transaction) => todayIn(await companyTimezone(employerId, transaction));

// ---------- recipients ----------

// The template audience's records for these ids (deleted ones included: they're inactive,
// not unknown). Any id that isn't one → 404 for the whole request (decision 25).
const loadRecipients = async (employerId, audience, ids) => {
  const unique = [...new Set(ids)];
  if (unique.some((id) => !UUID.test(id))) throw new ErrorHandler("NOT_FOUND");
  const rows =
    audience === "EMPLOYEE"
      ? await Employee.findAll({
          where: { id: { [Op.in]: unique }, employer_id: employerId },
          paranoid: false,
          include: [{ model: User, as: "user", attributes: ["email"] }],
        })
      : await StaffingCompany.findAll({ where: { id: { [Op.in]: unique }, employer_id: employerId }, paranoid: false });
  if (rows.length !== unique.length) throw new ErrorHandler("NOT_FOUND");
  const byId = new Map(rows.map((r) => [r.id, r]));
  return unique.map((id) => byId.get(id));
};

const recipientFacts = (audience, r) =>
  audience === "EMPLOYEE"
    ? { key: `E:${r.id}`, type: "EMPLOYEE", employee_id: r.id, staffing_company_id: null, name: r.full_name, email: r.user?.email || null }
    : { key: `S:${r.id}`, type: "STAFFING_COMPANY", employee_id: null, staffing_company_id: r.id, name: r.name, email: r.email || null };

// ---------- template ----------

const usableTemplate = async (employerId, templateId) => {
  const template = await ContractTemplate.findOne({
    where: { id: templateId, employer_id: employerId },
    include: [{ model: ContractTemplateField, as: "contractTemplateFields" }],
  });
  if (!template) throw new ErrorHandler("NOT_FOUND");
  // A template still without a type (migration backfill) can't be used either (decision 46).
  if (template.status !== "ACTIVE" || !template.contract_type_id) throw new ErrorHandler("CONTRACT_TEMPLATE_INACTIVE");
  if (!SUPPORTED_AUDIENCES.includes(template.audience_type)) throw new ErrorHandler("CONTRACT_AUDIENCE_UNSUPPORTED");
  return template;
};

// ---------- create ----------

// One DRAFT for one recipient, with its recipient row, a copy of the template's fields
// (ADR 0006) and a CREATED activity. Runs inside the caller's transaction.
const createDraft = async ({ employerId, userId, template, terms, recipient }, transaction) => {
  const contract = await Contract.create(
    {
      employer_id: employerId,
      contract_type_id: template.contract_type_id,
      template_id: template.id,
      document_id: template.document_id,
      name: terms.name || template.name,
      audience_type: template.audience_type,
      status: "DRAFT",
      page_count: template.page_count,
      start_date: terms.start_date,
      end_date: terms.end_date,
      renewal_due: terms.renewal_due,
      rate: terms.rate,
      rate_unit: terms.rate_unit,
      currency: terms.currency,
      notice_period_days: terms.notice_period_days,
      recipient_key: recipient.key,
      created_by: userId,
      meta: { sign_by: terms.sign_by },
    },
    { transaction }
  );
  const row = await ContractRecipient.create(
    {
      contract_id: contract.id,
      employer_id: employerId,
      recipient_type: recipient.type,
      employee_id: recipient.employee_id,
      staffing_company_id: recipient.staffing_company_id,
      recipient_name: recipient.name ? String(recipient.name).slice(0, 160) : null,
      recipient_email: recipient.email ? String(recipient.email).slice(0, 160) : null,
      role: "PRIMARY_SIGNER",
      status: "PENDING",
    },
    { transaction }
  );
  const fields = [...template.contractTemplateFields].sort((a, b) => a.sort_order - b.sort_order);
  await ContractField.bulkCreate(
    fields.map((f) => ({
      contract_id: contract.id,
      employer_id: employerId,
      recipient_id: row.id,
      template_field_id: f.id,
      page_no: f.page_no,
      field_type: f.field_type,
      label: f.label,
      field_key: f.field_key,
      checked_value: f.checked_value,
      db_source: f.db_source,
      db_column: f.db_column,
      pos_x: f.pos_x,
      pos_y: f.pos_y,
      width: f.width,
      height: f.height,
      is_required: f.is_required,
      meta: { sort_order: f.sort_order },
    })),
    { transaction }
  );
  await ContractActivity.create(
    {
      employer_id: employerId,
      contract_id: contract.id,
      recipient_id: row.id,
      action: "CREATED",
      actor_user_id: userId,
      meta: { template_id: template.id, contract_type_id: template.contract_type_id },
    },
    { transaction }
  );
  return contract;
};

// POST /contracts. Whole-request checks first (nothing written on failure), then one
// transaction per recipient (decision 25). `sendOne` (ticket 08) is used in SEND mode.
const createContracts = async (auth, body, { sendOne, beforeSend, lang } = {}) => {
  const { employerId } = auth;
  if (body.recipientIds.length > MAX_RECIPIENTS) throw new ErrorHandler("CONTRACT_BULK_LIMIT");
  const template = await usableTemplate(employerId, body.templateId);
  const today = await companyToday(employerId);
  const terms = normalizeTerms(body, today);
  assertTerms(terms, today);
  const recipients = await loadRecipients(employerId, template.audience_type, body.recipientIds);
  if (body.mode === "SEND" && beforeSend) await beforeSend({ employerId, today });

  const results = [];
  for (const r of recipients) {
    const recipient = recipientFacts(template.audience_type, r);
    let contract;
    try {
      contract = await sequelize.transaction((transaction) => createDraft({ ...auth, template, terms, recipient }, transaction));
    } catch (err) {
      console.error("[contracts] creating a contract failed", { recipient: recipient.key, error: err.message });
      results.push({ contractId: null, recipientName: recipient.name, result: "FAILED", code: "INTERNAL_ERROR", message: translate("INTERNAL_ERROR", lang) });
      continue;
    }
    if (body.mode === "SEND" && sendOne) {
      results.push({ recipientName: recipient.name, ...(await sendOne(auth, contract.id)) });
    } else {
      results.push({ contractId: contract.id, recipientName: recipient.name, result: "DRAFT" });
    }
  }
  return {
    results,
    sent: results.filter((r) => r.result === "SENT").length,
    drafts: results.filter((r) => r.result === "DRAFT").length,
    failed: results.filter((r) => r.result === "FAILED").length,
  };
};

// ---------- edit / delete drafts ----------

// The caller's contract locked FOR UPDATE inside `transaction`, or 404.
const lockContract = async (employerId, id, transaction) => {
  const c = UUID.test(String(id)) ? await Contract.findOne({ where: { id, employer_id: employerId }, transaction, lock: transaction.LOCK.UPDATE }) : null;
  if (!c) throw new ErrorHandler("NOT_FOUND");
  return c;
};

const termsOf = (c) => ({
  name: c.name,
  start_date: c.start_date,
  end_date: c.end_date,
  renewal_due: c.renewal_due,
  sign_by: c.meta?.sign_by ?? null,
  rate: c.rate === null ? null : money(c.rate),
  rate_unit: c.rate_unit,
  currency: c.currency,
  notice_period_days: c.notice_period_days,
});

// PUT /contracts/:id: a DRAFT's name and terms (decision 22). Given keys change; others keep.
const editDraft = async ({ employerId, userId }, id, body) =>
  sequelize.transaction(async (transaction) => {
    const c = await lockContract(employerId, id, transaction);
    if (c.status !== "DRAFT") throw new ErrorHandler("CONTRACT_STATUS_INVALID");
    const before = termsOf(c);
    const after = { ...before };
    TERM_KEYS.forEach((key) => {
      if (body[key] !== undefined) after[key] = orNull(body[key]);
    });
    if (after.rate === null) after.rate_unit = null;
    else after.rate = money(after.rate);
    if (!after.name) after.name = before.name;
    if (!after.currency) after.currency = DEFAULT_CURRENCY;
    if (!after.sign_by) after.sign_by = before.sign_by;
    if (after.rate !== null && !after.rate_unit) {
      throw new ErrorHandler("VALIDATION_FAILED", { errors: { rate_unit: "rateUnitRequired" } });
    }
    assertTerms(after, await companyToday(employerId, transaction));

    const changes = {};
    TERM_KEYS.forEach((key) => {
      if (String(before[key]) !== String(after[key])) changes[key] = { from: before[key], to: after[key] };
    });
    const { sign_by: signBy, ...columns } = after;
    await c.update({ ...columns, meta: { ...(c.meta || {}), sign_by: signBy } }, { transaction });
    if (Object.keys(changes).length) {
      await ContractActivity.create(
        { employer_id: employerId, contract_id: c.id, action: "UPDATED", actor_user_id: userId, meta: { changes } },
        { transaction }
      );
    }
    return contractItem(await Contract.findByPk(c.id, { include: ITEM_INCLUDE, transaction }));
  });

// DELETE /contracts/:id: a DRAFT only, soft; its activity rows stay (decision 42).
const deleteDraft = async ({ employerId }, id) =>
  sequelize.transaction(async (transaction) => {
    const c = await lockContract(employerId, id, transaction);
    if (c.status !== "DRAFT") throw new ErrorHandler("CONTRACT_STATUS_INVALID");
    await c.destroy({ transaction });
    return { id: c.id };
  });

module.exports = {
  createContracts,
  editDraft,
  deleteDraft,
  contractItem,
  lockContract,
  companyToday,
  termErrors,
  ITEM_INCLUDE,
  MAX_RECIPIENTS,
  SIGN_BY_MAX_DAYS,
};
