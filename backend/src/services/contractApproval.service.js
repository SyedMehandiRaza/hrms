const { sequelize, Contract, ContractActivity, ContractRecipient, ContractType, Employee, User } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { companyTimezone, formatDateTimeIn } = require("../utils/companyTime");
const { isRecipientActive } = require("./contractParties.service");
const { expireDue } = require("./contractExpiry.service");
const { findContract } = require("./contractQuery.service");
const { contractItem, ITEM_INCLUDE } = require("./contract.service");
const { buildFinalPdf } = require("./contractRender.service");
const { ContractPdfError } = require("./contractPdf.service");
const { checkReason } = require("./contractReject.service");
const { saveNew } = require("./contractFiles.service");
const storage = require("./storage.service");
const { emitContractEvent } = require("./contractEvents");

// HR approval and revoke (plan decisions 33–34, 37, 38; ADR 0007).
// Approve: one click, SUBMITTED → COMPLETED; the final PDF is built and stored in the same
// request (lock row + check → render → write under a new name → update + commit; a failure
// deletes the file and commits nothing). Nobody approves a contract they signed.

const reload = (id) => Contract.findByPk(id, { include: ITEM_INCLUDE });

// Certificate data (decision 38) from the signer's write-once evidence.
const certificateOf = async (contract, approver, approvedAt) => {
  const recipient = await ContractRecipient.findOne({ where: { contract_id: contract.id } });
  const type = await ContractType.findByPk(contract.contract_type_id, { attributes: ["name"] });
  const tz = await companyTimezone(contract.employer_id);
  const e = recipient?.evidence || {};
  return {
    contractNo: contract.reference_no,
    contractType: type?.name,
    documentSha256: e.document_sha256,
    evidence: {
      signerName: e.profile_name,
      accountId: e.account_id,
      userId: e.user_id,
      employeeId: e.employee_id,
      staffingCompanyId: e.staffing_company_id,
      signedAtUtc: e.signed_at,
      ip: e.ip,
      userAgent: e.user_agent,
      consentText: e.consent_text,
      consentVersion: e.consent_version,
      valuesSha256: e.values_sha256,
      signatures: (e.signatures || []).map((s) => ({ field: s.field_id, sha256: s.sha256, text: s.text })),
    },
    approverName: approver?.name,
    approvedAtUtc: approvedAt.toISOString(),
    approvedAtLocal: formatDateTimeIn(tz, approvedAt),
    timezone: tz,
  };
};

// POST /contracts/:id/approve. Order: 404, state, self-approval, recipient inactive.
const approveContract = async (auth, id) => {
  await expireDue({ employerId: auth.employerId }).catch(() => {});
  const contract = await findContract(auth.employerId, id, { include: [{ model: ContractRecipient, as: "contractRecipients" }] });
  if (contract.status !== "SUBMITTED") throw new ErrorHandler("CONTRACT_STATUS_INVALID");
  const recipient = contract.contractRecipients[0];
  if (recipient.employee_id) {
    const own = await Employee.findOne({ where: { user_id: auth.userId, employer_id: auth.employerId }, attributes: ["id"] });
    if (own && own.id === recipient.employee_id) throw new ErrorHandler("CONTRACT_SELF_APPROVAL");
  }
  if (!(await isRecipientActive(auth.employerId, contract.audience_type, recipient.employee_id || recipient.staffing_company_id))) {
    throw new ErrorHandler("CONTRACT_RECIPIENT_INACTIVE");
  }
  const approver = await User.findByPk(auth.userId, { attributes: ["id", "name"] });

  let written = null;
  try {
    await sequelize.transaction(async (transaction) => {
      const locked = await Contract.findOne({ where: { id: contract.id }, transaction, lock: transaction.LOCK.UPDATE });
      // A second approval stops here, before rendering anything.
      if (locked.status !== "SUBMITTED") throw new ErrorHandler("CONTRACT_STATUS_INVALID");
      const approvedAt = new Date();
      const { bytes } = await buildFinalPdf(locked, await certificateOf(locked, approver, approvedAt));
      written = await saveNew(auth.employerId, "signed", "pdf", bytes);
      await locked.update(
        { status: "COMPLETED", approved_by: auth.userId, approved_at: approvedAt, completed_at: approvedAt, signed_pdf_path: written.path, signed_pdf_sha256: written.sha256 },
        { transaction }
      );
      await ContractRecipient.update({ status: "COMPLETED" }, { where: { contract_id: contract.id }, transaction });
      await ContractActivity.create(
        { employer_id: auth.employerId, contract_id: contract.id, action: "COMPLETED", actor_user_id: auth.userId, meta: { signed_pdf_sha256: written.sha256 } },
        { transaction }
      );
    });
  } catch (err) {
    if (written) await storage.removePrivate(written.path).catch(() => {});
    if (err instanceof ErrorHandler) throw err;
    console.error("[contracts] approval failed", { contractId: contract.id, error: err.message, reason: err instanceof ContractPdfError ? err.reason : undefined });
    throw new ErrorHandler("INTERNAL_ERROR");
  }
  await emitContractEvent("COMPLETED", { contractId: contract.id });
  return contractItem(await reload(contract.id));
};

// POST /contracts/:id/revoke { reason }. SENT/VIEWED/SUBMITTED only (decision 33).
const REVOCABLE = ["SENT", "VIEWED", "SUBMITTED"];
const revokeContract = async (auth, id, body) => {
  await expireDue({ employerId: auth.employerId }).catch(() => {});
  const contract = await findContract(auth.employerId, id);
  if (!REVOCABLE.includes(contract.status)) throw new ErrorHandler("CONTRACT_STATUS_INVALID");
  const reason = checkReason(body);
  await sequelize.transaction(async (transaction) => {
    const locked = await Contract.findOne({ where: { id: contract.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!REVOCABLE.includes(locked.status)) throw new ErrorHandler("CONTRACT_STATUS_INVALID");
    await locked.update({ status: "REVOKED", revoke_reason: reason, revoked_at: new Date(), revoked_by: auth.userId }, { transaction });
    await ContractRecipient.update({ status: "REVOKED" }, { where: { contract_id: contract.id }, transaction });
    await ContractActivity.create(
      { employer_id: auth.employerId, contract_id: contract.id, action: "REVOKED", actor_user_id: auth.userId, meta: { reason } },
      { transaction }
    );
  });
  await emitContractEvent("REVOKED", { contractId: contract.id, auto: false, reason });
  return contractItem(await reload(contract.id));
};

module.exports = { approveContract, revokeContract };
