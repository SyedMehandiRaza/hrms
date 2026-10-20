const { Op } = require("sequelize");
const { sequelize, Contract, ContractField, ContractActivity, ContractRecipient, ContractType, ContractTemplate, User } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { likePattern, UUID } = require("./department.service");
const { contractItem, ITEM_INCLUDE } = require("./contract.service");
const { expireDue } = require("./contractExpiry.service");
const { contractPdf, parseSignature } = require("./contractRender.service");

// HR reads (plan decisions 22, 36, 39, 42): list, stats, detail with activity, PDF.
// Each first expires the company's due contracts (lazy expiry, decision 36).

const STATUSES = ["DRAFT", "SENT", "VIEWED", "SUBMITTED", "COMPLETED", "REJECTED", "EXPIRED", "REVOKED"];
const AUDIENCES = ["EMPLOYEE", "STAFFING_COMPANY"];

// Activities share whole-second timestamps; ties follow the lifecycle (newest stage first).
const ACTIVITY_ORDER = sequelize.literal(
  "FIELD(`ContractActivity`.`action`, 'COMPLETED','REVOKED','EXPIRED','DECLINED','SIGNED','REMINDED','VIEWED','SENT','UPDATED','CREATED')"
);

const findContract = async (employerId, id, options = {}) => {
  const c = UUID.test(String(id)) ? await Contract.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!c) throw new ErrorHandler("NOT_FOUND");
  return c;
};

// List items with each contract's field count (the lists' Fields column).
const withFieldCounts = async (rows) => {
  const counts = rows.length
    ? await ContractField.findAll({
        where: { contract_id: rows.map((r) => r.id) },
        attributes: ["contract_id", [sequelize.fn("COUNT", sequelize.col("id")), "n"]],
        group: ["contract_id"],
        raw: true,
      })
    : [];
  const fieldCount = Object.fromEntries(counts.map((r) => [r.contract_id, Number(r.n)]));
  return rows.map((r) => ({ ...contractItem(r), field_count: fieldCount[r.id] || 0 }));
};

const listContracts = async ({ employerId }, { page, limit, q, status, audience, type }) => {
  await expireDue({ employerId });
  const where = { employer_id: employerId };
  if (status) where.status = { [Op.in]: status.split(",") };
  if (audience) where.audience_type = audience;
  if (type) where.contract_type_id = type;
  if (q) {
    const pattern = likePattern(q);
    const byRecipient = await ContractRecipient.findAll({
      where: { employer_id: employerId, recipient_name: { [Op.like]: pattern } },
      attributes: ["contract_id"],
      raw: true,
    });
    where[Op.or] = [
      { name: { [Op.like]: pattern } },
      { reference_no: { [Op.like]: pattern } },
      { id: byRecipient.map((r) => r.contract_id) },
    ];
  }
  const total = await Contract.count({ where });
  const rows = await Contract.findAll({
    where,
    include: ITEM_INCLUDE,
    order: [
      ["createdAt", "DESC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: await withFieldCounts(rows), total, page, limit };
};

const contractStats = async ({ employerId }) => {
  await expireDue({ employerId });
  const count = async (column) =>
    Contract.findAll({ where: { employer_id: employerId }, attributes: [column, [sequelize.fn("COUNT", sequelize.col("id")), "n"]], group: [column], raw: true });
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  (await count("status")).forEach((r) => {
    if (r.status in byStatus) byStatus[r.status] = Number(r.n);
  });
  const byAudience = Object.fromEntries(AUDIENCES.map((a) => [a, 0]));
  (await count("audience_type")).forEach((r) => {
    if (r.audience_type in byAudience) byAudience[r.audience_type] = Number(r.n);
  });
  return { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus, byAudience };
};

// A field as the API shows it: signature values without their storage path.
const fieldView = (f) => {
  let value = f.value;
  if (f.field_type === "SIGNATURE" || f.field_type === "INITIALS") {
    const sig = parseSignature(f.value);
    value = sig ? (sig.type === "TYPED" ? { type: "TYPED", text: sig.text } : { type: "DRAWN", sha256: sig.sha256 }) : null;
  }
  return {
    id: f.id,
    field_type: f.field_type,
    page_no: f.page_no,
    pos_x: Number(f.pos_x),
    pos_y: Number(f.pos_y),
    width: f.width === null ? null : Number(f.width),
    height: f.height === null ? null : Number(f.height),
    label: f.label,
    is_required: f.is_required,
    db_source: f.db_source,
    db_column: f.db_column,
    value,
  };
};

const fieldsOf = async (contractId) =>
  (await ContractField.findAll({ where: { contract_id: contractId } }))
    .sort((a, b) => (a.meta?.sort_order ?? 0) - (b.meta?.sort_order ?? 0))
    .map(fieldView);

const getContract = async ({ employerId }, id) => {
  if (UUID.test(String(id))) await expireDue({ employerId, contractId: id });
  const c = await findContract(employerId, id, {
    include: [
      { model: ContractType, as: "contractType" },
      { model: ContractRecipient, as: "contractRecipients" },
      { model: ContractTemplate, as: "template", attributes: ["id", "name"], paranoid: false },
    ],
  });
  const activity = await ContractActivity.findAll({
    where: { contract_id: c.id },
    include: [{ model: User, as: "actorUser", attributes: ["id", "name"] }],
    order: [
      ["createdAt", "DESC"],
      [ACTIVITY_ORDER, "ASC"],
    ],
  });
  return {
    ...contractItem(c),
    template: c.template ? { id: c.template.id, name: c.template.name } : null,
    page_count: c.page_count,
    values_sha256: c.values_sha256,
    signed_pdf_sha256: c.signed_pdf_sha256,
    fields: await fieldsOf(c.id),
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      actor: a.actorUser ? { id: a.actorUser.id, name: a.actorUser.name } : null,
      description: a.description,
      meta: a.meta,
      created_at: a.createdAt,
    })),
  };
};

// GET /contracts/:id/pdf (decision 39).
const hrContractPdf = async ({ employerId }, id) => {
  if (UUID.test(String(id))) await expireDue({ employerId, contractId: id });
  return contractPdf(await findContract(employerId, id));
};

module.exports = { withFieldCounts, listContracts, contractStats, getContract, hrContractPdf, fieldView, fieldsOf, findContract, ACTIVITY_ORDER };
