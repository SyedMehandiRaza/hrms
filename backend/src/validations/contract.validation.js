const Joi = require("joi");
const { INVALID } = require("./department.validation");

// Contract Studio query/body schemas (plan docs/plans/contract-studio.md). Message values
// are keys of FIELD_MESSAGES or codes (standards §7.3); values with no own message carry
// the VALIDATION_FAILED text.

const page = Joi.number().integer().min(1).default(1).messages({
  "number.base": INVALID,
  "number.integer": INVALID,
  "number.min": INVALID,
  "number.unsafe": INVALID,
});
const limit = Joi.number().integer().min(1).max(100).default(20).messages({
  "number.base": INVALID,
  "number.integer": INVALID,
  "number.min": INVALID,
  "number.max": INVALID,
  "number.unsafe": INVALID,
});
const search = Joi.string().trim().max(150).allow("").default("").messages({ "string.base": INVALID, "string.max": INVALID });
const optionalId = Joi.string().trim().guid().allow("").messages({ "string.base": INVALID, "string.guid": INVALID });

const pagination = { page, limit };

// GET /contract-recipients?audience=&projectId=&staffingCompanyId=&q=&page=&limit=
// The audience itself is checked by the service (CONTRACT_AUDIENCE_UNSUPPORTED).
const recipientLookupSchema = Joi.object({
  audience: Joi.string().trim().allow("").messages({ "string.base": INVALID }),
  projectId: optionalId,
  staffingCompanyId: optionalId,
  q: search,
  ...pagination,
});

// ---------- contract types (decision 15; standards §7.3 "Contract type") ----------
const { noEmoji, required } = require("./department.validation");

// POST /contract-types and PUT /contract-types/:id. Code stored uppercase. On edit, a
// missing description / is_active keeps the current value; "" or null clears description.
const contractTypeSchema = Joi.object({
  name: noEmoji(Joi.string().trim().min(2).max(150))
    .required()
    .messages({
      ...required("contractTypeNameRequired"),
      "string.min": "nameMin",
      "string.max": "contractTypeNameMax",
      "string.pattern.invert.base": "noEmojis",
    }),
  code: noEmoji(Joi.string().trim().uppercase().min(2).max(100))
    .required()
    .messages({
      ...required("codeRequired"),
      "string.min": "codeMin",
      "string.max": "codeMax100",
      "string.pattern.invert.base": "noEmojis",
    }),
  description: Joi.string().trim().max(500).allow("", null).messages({ "string.base": INVALID, "string.max": "descriptionMax500" }),
  is_active: Joi.boolean().messages({ "boolean.base": INVALID }),
});

const listContractTypesSchema = Joi.object({
  ...pagination,
  search,
  status: Joi.string().valid("ACTIVE", "INACTIVE").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
});

// ---------- documents (decisions 6–7; standards §7.3 "Document rename") ----------
const listDocumentsSchema = Joi.object({
  ...pagination,
  search,
  status: Joi.string().valid("SAVED", "ARCHIVED").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
});

// PATCH /contract-documents/:id: rename and/or archive (SAVED ⇄ ARCHIVED).
const documentUpdateSchema = Joi.object({
  name: Joi.string().trim().max(255).messages({ ...required("documentNameRequired"), "string.max": "documentNameMax" }),
  status: Joi.string().valid("SAVED", "ARCHIVED").messages({ "string.base": INVALID, "string.empty": INVALID, "any.only": INVALID }),
});

// ---------- templates (decisions 9–14; standards §7.3 "Template") ----------
const FIELD_TYPES = ["INPUT", "CHECKBOX", "DATE", "INITIALS", "SIGNATURE", "DB_COLUMN"];
const invalidNumber = { "number.base": INVALID, "number.unsafe": INVALID, "any.required": INVALID };

// One placed field. Positions are page-relative decimals; bounds, page count, merge tokens
// and the signature rules are checked by the service (they need the document/audience).
const templateFieldSchema = Joi.object({
  field_type: Joi.string()
    .valid(...FIELD_TYPES)
    .required()
    .messages({ "string.base": INVALID, "any.only": INVALID, "any.required": INVALID, "string.empty": INVALID }),
  page_no: Joi.number().integer().required().messages({ ...invalidNumber, "number.integer": INVALID }),
  pos_x: Joi.number().required().messages(invalidNumber),
  pos_y: Joi.number().required().messages(invalidNumber),
  width: Joi.number().required().messages(invalidNumber),
  height: Joi.number().required().messages(invalidNumber),
  label: Joi.string().trim().max(160).allow("", null).messages({ "string.base": INVALID, "string.max": "templateLabelMax" }),
  is_required: Joi.boolean().default(true).messages({ "boolean.base": INVALID }),
  db_source: Joi.string().trim().allow("", null).messages({ "string.base": INVALID }),
  db_column: Joi.string().trim().allow("", null).messages({ "string.base": INVALID }),
});

const templateSchema = Joi.object({
  name: Joi.string().trim().max(255).required().messages({ ...required("templateNameRequired"), "string.max": "templateNameMax" }),
  description: Joi.string().trim().max(2000).allow("", null).messages({ "string.base": INVALID, "string.max": INVALID }),
  audienceType: Joi.string().trim().allow("", null).messages({ "string.base": INVALID }),
  documentId: Joi.string().trim().allow("", null).messages({ "string.base": "templateDocumentRequired" }),
  contractTypeId: Joi.string().trim().allow("", null).messages({ "string.base": "contractTypeRequired" }),
  fields: Joi.array().items(templateFieldSchema).default([]).messages({ "array.base": "templateFieldsRequired" }),
});

const templateStatusSchema = Joi.object({
  status: Joi.string().valid("ACTIVE", "ARCHIVED").required().messages({ "string.base": INVALID, "string.empty": INVALID, "any.only": INVALID, "any.required": INVALID }),
});

const listTemplatesSchema = Joi.object({
  ...pagination,
  search,
  status: Joi.string().valid("ACTIVE", "ARCHIVED").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
  audience: Joi.string().valid("EMPLOYEE", "STAFFING_COMPANY").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
});

const mergeFieldsQuerySchema = Joi.object({ audience: Joi.string().trim().allow("").messages({ "string.base": INVALID }) });

// ---------- drafts / send (decisions 18–22; standards §7.3 "Draft / send") ----------
const { CURRENCIES } = require("../constants/currencies");
const { isRealDate } = require("../utils/companyTime");

const RATE_UNITS = ["HOURLY", "DAILY", "MONTHLY", "ANNUAL"];
const MAX_RATE = 9999999999.99; // DECIMAL(12,2)

// "YYYY-MM-DD" that is a real date, else `key`.
const dateOnly = (key) =>
  Joi.string()
    .trim()
    .custom((value, helpers) => (isRealDate(value) ? value : helpers.error("any.invalid")))
    .messages({ "string.base": key, "string.empty": key, "any.invalid": key });

const hasTwoDecimalsAtMost = (v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

// Terms shared by create and edit. Relations to "today" (company time) and between dates
// are checked by the service. Absent optional terms are null.
const termFields = {
  name: Joi.string().trim().max(255).allow("", null).messages({ "string.base": INVALID, "string.max": "contractNameMax" }),
  start_date: dateOnly("dateInvalid").messages({ "any.required": "startDateRequired", "string.empty": "startDateRequired" }),
  end_date: dateOnly("dateInvalid").allow("", null),
  renewal_due: dateOnly("dateInvalid").allow("", null),
  sign_by: dateOnly("signByRange").allow("", null),
  rate: Joi.number()
    .positive()
    .max(MAX_RATE)
    .custom((v, helpers) => (hasTwoDecimalsAtMost(v) ? v : helpers.error("any.invalid")))
    .allow(null, "")
    .messages({ "number.base": "rateInvalid", "number.positive": "rateInvalid", "number.max": "rateInvalid", "number.unsafe": "rateInvalid", "any.invalid": "rateInvalid" }),
  rate_unit: Joi.string()
    .valid(...RATE_UNITS)
    .allow(null, "")
    .when("rate", { is: Joi.number().required(), then: Joi.required().invalid(null, "") })
    .messages({ "string.base": "rateUnitRequired", "any.only": "rateUnitRequired", "any.required": "rateUnitRequired", "any.invalid": "rateUnitRequired" }),
  currency: Joi.string()
    .trim()
    .valid(...CURRENCIES)
    .allow(null, "")
    .messages({ "string.base": "currencyInvalid", "any.only": "currencyInvalid" }),
  notice_period_days: Joi.number()
    .integer()
    .min(0)
    .max(365)
    .allow(null, "")
    .messages({ "number.base": "noticePeriodRange", "number.integer": "noticePeriodRange", "number.min": "noticePeriodRange", "number.max": "noticePeriodRange" }),
};

// POST /contracts { mode, templateId, recipientIds[], name?, ...terms } (plan endpoints).
const createContractsSchema = Joi.object({
  mode: Joi.string().valid("DRAFT", "SEND").required().messages({ "string.base": INVALID, "any.only": INVALID, "any.required": INVALID, "string.empty": INVALID }),
  templateId: Joi.string().trim().guid().required().messages({ ...required("contractTemplateRequired"), "string.guid": "contractTemplateRequired" }),
  recipientIds: Joi.array()
    .items(Joi.string().trim())
    .min(1)
    .required()
    .messages({ "array.base": "contractRecipientsRequired", "array.min": "contractRecipientsRequired", "any.required": "contractRecipientsRequired", "string.base": INVALID }),
  ...termFields,
  start_date: termFields.start_date.required(),
});

// PUT /contracts/:id (drafts): name and terms only; template/recipient keys are stripped.
const editDraftSchema = Joi.object(termFields);

// GET /contracts?status=&audience=&type=&q=&page=&limit=
const CONTRACT_STATUSES = ["DRAFT", "SENT", "VIEWED", "SUBMITTED", "COMPLETED", "REJECTED", "EXPIRED", "REVOKED"];
const listContractsSchema = Joi.object({
  ...pagination,
  q: search,
  status: Joi.string().valid(...CONTRACT_STATUSES).allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
  audience: Joi.string().valid("EMPLOYEE", "STAFFING_COMPANY").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
  type: optionalId,
});

module.exports = {
  createContractsSchema,
  listContractsSchema,
  editDraftSchema,
  RATE_UNITS,
  recipientLookupSchema,
  contractTypeSchema,
  listContractTypesSchema,
  listDocumentsSchema,
  documentUpdateSchema,
  templateSchema,
  templateStatusSchema,
  listTemplatesSchema,
  mergeFieldsQuerySchema,
  pagination,
  search,
  optionalId,
  page,
  limit,
};
