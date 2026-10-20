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

module.exports = { recipientLookupSchema, pagination, search, optionalId, page, limit };
