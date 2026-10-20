const { Op } = require("sequelize");
const { sequelize, ContractTemplate, ContractTemplateField, ContractDocument, ContractType, Contract } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { likePattern, UUID } = require("./department.service");
const { SUPPORTED_AUDIENCES } = require("./contractParties.service");
const { groupsFor, findMergeField } = require("../constants/contractMergeFields");

// Templates (plan decisions 9–14): one SAVED document + placed fields + a contract type.
// ACTIVE | ARCHIVED, freely editable (contracts copy the fields, ADR 0006), never versioned.

const MAX_FIELDS = 200;
const MAX_SIGNING_MARKS = 20; // SIGNATURE + INITIALS (decision 12)
const MIN_BOX = 0.01;
const TYPE_LABELS = { INPUT: "Text Input", CHECKBOX: "Checkbox", DATE: "Date", INITIALS: "Initials", SIGNATURE: "Signature" };

const num = (v) => (v === null || v === undefined ? null : Number(v));

const fieldItem = (f) => ({
  id: f.id,
  field_type: f.field_type,
  page_no: f.page_no,
  pos_x: num(f.pos_x),
  pos_y: num(f.pos_y),
  width: num(f.width),
  height: num(f.height),
  label: f.label,
  is_required: f.is_required,
  db_source: f.db_source ?? null,
  db_column: f.db_column ?? null,
  field_key: f.field_key ?? null,
  checked_value: f.checked_value ?? null,
  sort_order: f.sort_order,
});

const toItem = (t, { withFields = true } = {}) => {
  const fields = [...(t.contractTemplateFields || [])].sort((a, b) => a.sort_order - b.sort_order);
  const item = {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    audience_type: t.audience_type,
    status: t.status,
    page_count: t.page_count,
    document: t.document ? { id: t.document.id, name: t.document.name, page_count: t.document.page_count, status: t.document.status } : null,
    contract_type: t.contractType
      ? { id: t.contractType.id, name: t.contractType.name, code: t.contractType.code, is_active: t.contractType.is_active }
      : null,
    field_count: fields.length,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
  if (withFields) item.fields = fields.map(fieldItem);
  return item;
};

const INCLUDE = [
  { model: ContractDocument, as: "document", paranoid: false },
  { model: ContractType, as: "contractType" },
  { model: ContractTemplateField, as: "contractTemplateFields" },
];

const findTemplate = async (employerId, id, options = {}) => {
  const t = UUID.test(String(id)) ? await ContractTemplate.findOne({ where: { id, employer_id: employerId }, include: INCLUDE, ...options }) : null;
  if (!t) throw new ErrorHandler("NOT_FOUND");
  return t;
};

const reload = (employerId, id, transaction) => findTemplate(employerId, id, { transaction });

const assertAudience = (audience) => {
  if (!SUPPORTED_AUDIENCES.includes(audience)) throw new ErrorHandler("CONTRACT_AUDIENCE_UNSUPPORTED");
};

// Usable document: the company's, not deleted; archived → 409 (decision 7).
const usableDocument = async (employerId, documentId) => {
  const doc = documentId && UUID.test(documentId) ? await ContractDocument.findOne({ where: { id: documentId, employer_id: employerId } }) : null;
  if (!doc) return { error: "templateDocumentRequired" };
  if (doc.status === "ARCHIVED") throw new ErrorHandler("CONTRACT_DOCUMENT_ARCHIVED");
  return { doc };
};

const usableType = async (employerId, typeId) => {
  const type = typeId && UUID.test(typeId) ? await ContractType.findOne({ where: { id: typeId, employer_id: employerId, is_active: true } }) : null;
  return type || null;
};

// Field rules (decision 12). Returns an errors map (empty when fine).
const fieldErrors = (fields, audience, pageCount) => {
  const errors = {};
  const setFields = (key) => {
    if (!errors.fields) errors.fields = key;
  };
  if (!fields.length) setFields("templateFieldsRequired");
  else if (fields.length > MAX_FIELDS) setFields("templateFieldLimit");
  if (fields.filter((f) => ["SIGNATURE", "INITIALS"].includes(f.field_type)).length > MAX_SIGNING_MARKS) setFields("templateSignatureLimit");
  fields.forEach((f, i) => {
    const x = f.pos_x;
    const y = f.pos_y;
    const inside =
      f.page_no >= 1 &&
      (!pageCount || f.page_no <= pageCount) &&
      x >= 0 &&
      y >= 0 &&
      f.width >= MIN_BOX &&
      f.height >= MIN_BOX &&
      x + f.width <= 1 + 1e-9 &&
      y + f.height <= 1 + 1e-9;
    if (!inside) setFields("templateFieldOutsidePage");
    if (f.field_type === "DB_COLUMN" && !findMergeField(audience, f.db_source, f.db_column)) errors[`fields.${i}.db_column`] = "mergeFieldUnknown";
  });
  if (fields.length && !fields.some((f) => f.field_type === "SIGNATURE" && f.is_required)) setFields("templateSignatureRequired");
  return errors;
};

// Label: as given, else the catalogue label (merge field) or the type name.
const labelOf = (f, audience) => {
  if (f.label) return f.label;
  if (f.field_type === "DB_COLUMN") return findMergeField(audience, f.db_source, f.db_column)?.label || f.db_column;
  return TYPE_LABELS[f.field_type];
};

// Validates the whole body; returns { doc, type }. Codes first, then one VALIDATION_FAILED
// with every field problem.
const checkBody = async (employerId, body) => {
  assertAudience(body.audienceType);
  const errors = {};
  const { doc, error: docError } = await usableDocument(employerId, body.documentId);
  if (docError) errors.documentId = docError;
  const type = await usableType(employerId, body.contractTypeId);
  if (!type) errors.contractTypeId = "contractTypeRequired";
  Object.assign(errors, fieldErrors(body.fields, body.audienceType, doc?.page_count));
  if (Object.keys(errors).length) throw new ErrorHandler("VALIDATION_FAILED", { errors });
  return { doc, type };
};

const fieldRows = (employerId, templateId, fields, audience) =>
  fields.map((f, i) => ({
    template_id: templateId,
    employer_id: employerId,
    field_type: f.field_type,
    page_no: f.page_no,
    pos_x: f.pos_x,
    pos_y: f.pos_y,
    width: f.width,
    height: f.height,
    label: labelOf(f, audience),
    is_required: f.is_required,
    db_source: f.field_type === "DB_COLUMN" ? f.db_source : null,
    db_column: f.field_type === "DB_COLUMN" ? f.db_column : null,
    field_key: f.field_key || null,
    checked_value: f.field_type === "CHECKBOX" ? f.checked_value || null : null,
    assigned_role: "PRIMARY_SIGNER",
    sort_order: i,
  }));

const listTemplates = async ({ employerId }, { page, limit, search, status, audience }) => {
  const where = { employer_id: employerId };
  if (status) where.status = status;
  if (audience) where.audience_type = audience;
  if (search) where.name = { [Op.like]: likePattern(search) };
  const total = await ContractTemplate.count({ where });
  const rows = await ContractTemplate.findAll({
    where,
    include: INCLUDE,
    order: [
      ["createdAt", "DESC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: rows.map((t) => toItem(t, { withFields: false })), total, page, limit };
};

const getTemplate = async ({ employerId }, id) => toItem(await findTemplate(employerId, id));

const createTemplate = async ({ employerId, userId }, body) => {
  const { doc, type } = await checkBody(employerId, body);
  return sequelize.transaction(async (transaction) => {
    const t = await ContractTemplate.create(
      {
        employer_id: employerId,
        document_id: doc.id,
        contract_type_id: type.id,
        name: body.name,
        description: body.description || null,
        audience_type: body.audienceType,
        page_count: doc.page_count,
        status: "ACTIVE",
        created_by: userId,
      },
      { transaction }
    );
    await ContractTemplateField.bulkCreate(fieldRows(employerId, t.id, body.fields, body.audienceType), { transaction });
    return toItem(await reload(employerId, t.id, transaction));
  });
};

// Replaces name, audience, document, type and every field. Existing contracts keep their
// own copies (template_field_id is set to NULL on them by the foreign key).
const updateTemplate = async ({ employerId }, id, body) => {
  const t = await findTemplate(employerId, id);
  const { doc, type } = await checkBody(employerId, body);
  return sequelize.transaction(async (transaction) => {
    await t.update(
      {
        name: body.name,
        description: body.description === undefined ? t.description : body.description || null,
        audience_type: body.audienceType,
        document_id: doc.id,
        contract_type_id: type.id,
        page_count: doc.page_count,
      },
      { transaction }
    );
    await ContractTemplateField.destroy({ where: { template_id: t.id }, transaction });
    await ContractTemplateField.bulkCreate(fieldRows(employerId, t.id, body.fields, body.audienceType), { transaction });
    return toItem(await reload(employerId, t.id, transaction));
  });
};

const copyName = (name) => {
  const suffix = " (copy)";
  return `${name.slice(0, 255 - suffix.length)}${suffix}`;
};

// POST /contract-templates/:id/duplicate → a new ACTIVE "<name> (copy)" with the same fields.
const duplicateTemplate = async (auth, id) => {
  const t = await findTemplate(auth.employerId, id);
  const fields = [...t.contractTemplateFields].sort((a, b) => a.sort_order - b.sort_order).map(fieldItem);
  return createTemplate(auth, {
    name: copyName(t.name),
    description: t.description,
    audienceType: t.audience_type,
    documentId: t.document_id,
    contractTypeId: t.contract_type_id,
    fields,
  });
};

// PATCH /contract-templates/:id/status. Unarchiving needs a SAVED document and an active type.
const setTemplateStatus = async ({ employerId }, id, { status }) => {
  const t = await findTemplate(employerId, id);
  if (status === "ACTIVE" && t.status !== "ACTIVE") {
    if (!t.document || t.document.deletedAt || t.document.status === "ARCHIVED") throw new ErrorHandler("CONTRACT_DOCUMENT_ARCHIVED");
    if (!(await usableType(employerId, t.contract_type_id))) {
      throw new ErrorHandler("VALIDATION_FAILED", { errors: { contractTypeId: "contractTypeRequired" } });
    }
  }
  await t.update({ status });
  return toItem(await reload(employerId, t.id));
};

const deleteTemplate = async ({ employerId }, id) => {
  const t = await findTemplate(employerId, id);
  if (await Contract.count({ where: { template_id: t.id }, paranoid: false })) throw new ErrorHandler("CONTRACT_TEMPLATE_IN_USE");
  await t.destroy();
  return { id: t.id };
};

const mergeFieldCatalogue = (audience) => {
  assertAudience(audience);
  return groupsFor(audience);
};

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  setTemplateStatus,
  deleteTemplate,
  mergeFieldCatalogue,
  findTemplate,
  fieldItem,
};
