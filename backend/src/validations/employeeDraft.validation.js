const Joi = require("joi");
const { INVALID, listDepartmentsSchema } = require("./department.validation");

// Employee drafts (workforce D53): no field validation; the wizard's data is any JSON object
// up to 1 MB. The name and email are copied from the wizard for the drafts list.
const MAX_DATA_BYTES = 1024 * 1024;

const looseText = Joi.string().trim().allow("", null).messages({ "string.base": INVALID });

const draftSchema = Joi.object({
  step: Joi.number().integer().min(1).max(5).required().messages({
    "any.required": INVALID,
    "number.base": INVALID,
    "number.integer": INVALID,
    "number.min": INVALID,
    "number.max": INVALID,
  }),
  fullName: looseText,
  email: looseText,
  data: Joi.object()
    .unknown(true)
    .required()
    .custom((value, helpers) => (Buffer.byteLength(JSON.stringify(value)) > MAX_DATA_BYTES ? helpers.error("draft.tooLarge") : value))
    .messages({ "any.required": INVALID, "object.base": INVALID, "draft.tooLarge": "draftTooLarge" }),
});

const listDraftsSchema = listDepartmentsSchema.fork(["search", "status"], (s) => s.strip());

module.exports = { draftSchema, listDraftsSchema, MAX_DATA_BYTES };
