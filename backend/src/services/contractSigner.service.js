const { Op } = require("sequelize");
const { sequelize, Contract, ContractRecipient, ContractActivity, ContractDocument, ContractType, Employee, StaffingCompany } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { likePattern, UUID } = require("./department.service");
const { contractItem } = require("./contract.service");
const { expireDue } = require("./contractExpiry.service");
const { fieldsOf, withFieldCounts } = require("./contractQuery.service");
const { contractPdf } = require("./contractRender.service");
const { readVerified } = require("./contractFiles.service");

// The signer's side (plan decisions 26–28): My Contracts for employees (and the owner's or a
// sub-admin's own, through My Requests) and for staffing companies. No permission flag:
// visibility is the rule. Anything not addressed to the caller → 404; drafts never show.

// Who the caller signs as in this company, or null (e.g. an admin with no employee record).
const signerOf = async ({ userId, employerId, accessLevel }) => {
  if (accessLevel === ACCESS_LEVELS.STAFFING_COMPANY) {
    const company = await StaffingCompany.findOne({ where: { user_id: userId, employer_id: employerId }, attributes: ["id"] });
    return company ? { audience: "STAFFING_COMPANY", id: company.id } : null;
  }
  const employee = await Employee.findOne({ where: { user_id: userId, employer_id: employerId }, attributes: ["id"] });
  return employee ? { audience: "EMPLOYEE", id: employee.id } : null;
};

const recipientWhere = (signer) =>
  signer.audience === "EMPLOYEE" ? { employee_id: signer.id } : { staffing_company_id: signer.id };

const visibleWhere = (employerId, signer) => ({
  employer_id: employerId,
  audience_type: signer.audience,
  status: { [Op.ne]: "DRAFT" },
});

// The caller's contract (any non-draft status) or 404.
const findVisible = async (auth, id, options = {}) => {
  const signer = await signerOf(auth);
  if (!signer || !UUID.test(String(id))) throw new ErrorHandler("NOT_FOUND");
  const c = await Contract.findOne({
    where: { ...visibleWhere(auth.employerId, signer), id },
    include: [
      { model: ContractRecipient, as: "contractRecipients", where: recipientWhere(signer), required: true },
      { model: ContractType, as: "contractType" },
    ],
    ...options,
  });
  if (!c) throw new ErrorHandler("NOT_FOUND");
  return { contract: c, signer };
};

// Pending (SENT/VIEWED) first, oldest sent first; then the rest by latest activity (decision 27).
const ORDER = [
  [sequelize.literal("CASE WHEN `Contract`.`status` IN ('SENT','VIEWED') THEN 0 ELSE 1 END"), "ASC"],
  [sequelize.literal("CASE WHEN `Contract`.`status` IN ('SENT','VIEWED') THEN `Contract`.`sent_at` END"), "ASC"],
  [sequelize.literal("(SELECT MAX(a.created_at) FROM hrms_contract_activities a WHERE a.contract_id = `Contract`.`id`)"), "DESC"],
  ["id", "ASC"],
];

const listMine = async (auth, { page, limit, q }) => {
  const signer = await signerOf(auth);
  if (!signer) return { items: [], total: 0, page, limit };
  await expireDue({ employerId: auth.employerId });
  const where = visibleWhere(auth.employerId, signer);
  if (q) {
    const pattern = likePattern(q);
    where[Op.or] = [{ name: { [Op.like]: pattern } }, { reference_no: { [Op.like]: pattern } }];
  }
  const include = [
    { model: ContractRecipient, as: "contractRecipients", where: recipientWhere(signer), required: true },
    { model: ContractType, as: "contractType" },
  ];
  const total = await Contract.count({ where, include: [include[0]], distinct: true, col: "id" });
  const rows = await Contract.findAll({ where, include, order: ORDER, limit, offset: (page - 1) * limit, subQuery: false });
  return { items: await withFieldCounts(rows), total, page, limit };
};

// First open of a SENT contract by its signer → VIEWED (decision 28). Conditional, so two
// tabs opening at once log one activity.
const markViewed = async (auth, c, { ip, userAgent }) => {
  if (c.status !== "SENT") return;
  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    const [count] = await Contract.update(
      { status: "VIEWED", viewed_at: now },
      { where: { id: c.id, status: "SENT", expires_at: { [Op.gt]: now } }, transaction }
    );
    if (count !== 1) return;
    const recipient = c.contractRecipients[0];
    await ContractRecipient.update({ status: "VIEWED", viewed_at: now }, { where: { id: recipient.id }, transaction });
    await ContractActivity.create(
      {
        employer_id: c.employer_id,
        contract_id: c.id,
        recipient_id: recipient.id,
        action: "VIEWED",
        actor_user_id: auth.userId,
        meta: { ip: ip || null, user_agent: userAgent ? String(userAgent).slice(0, 255) : null },
      },
      { transaction }
    );
  });
};

const getMine = async (auth, id, request) => {
  if (UUID.test(String(id))) await expireDue({ employerId: auth.employerId, contractId: id });
  const { contract } = await findVisible(auth, id);
  await markViewed(auth, contract, request);
  const fresh = (await findVisible(auth, id)).contract;
  const document = await ContractDocument.findByPk(fresh.document_id, { paranoid: false, attributes: ["id", "page_count"] });
  return { ...contractItem(fresh), page_count: document?.page_count ?? fresh.page_count, fields: await fieldsOf(fresh.id) };
};

// The original PDF (for rendering pages under the fillable fields).
const myDocument = async (auth, id) => {
  const { contract } = await findVisible(auth, id);
  const document = await ContractDocument.findByPk(contract.document_id, { paranoid: false });
  if (!document) throw new ErrorHandler("NOT_FOUND");
  const bytes = await readVerified(document.file_path, document.file_sha256, { documentId: document.id });
  return { bytes, fileName: document.original_file_name || `${document.name}.pdf` };
};

const myPdf = async (auth, id) => {
  if (UUID.test(String(id))) await expireDue({ employerId: auth.employerId, contractId: id });
  const { contract } = await findVisible(auth, id);
  return contractPdf(contract);
};

module.exports = { listMine, getMine, myDocument, myPdf, findVisible, signerOf };
