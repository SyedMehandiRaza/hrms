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

module.exports = {
  recipientLookupSchema,
  contractTypeSchema,
  listContractTypesSchema,
  pagination,
  search,
  optionalId,
  page,
  limit,
};
