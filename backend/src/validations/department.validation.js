const Joi = require("joi");

// Same characters the UI's DepartmentModal refuses (its noEmoji rule:
// /^[^\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u), so client and server agree.
const EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
const noEmoji = (schema) => schema.pattern(EMOJI, { invert: true });

// Message keys for "missing": absent, null, blank after trimming, or not a string.
const required = (key) => ({ "any.required": key, "string.empty": key, "string.base": key });

// Query and body values with no own message in standards §7.2 (bad page, unknown status, …)
// carry the VALIDATION_FAILED text under the field.
const INVALID = "VALIDATION_FAILED";
const STATUSES = ["ACTIVE", "INACTIVE"];

// POST /departments and PUT /departments/:id (standards §7.2 "Department", D31).
// name and code are always required. On create, missing optional fields get their defaults
// (description/head null, status ACTIVE); on edit they keep their current values, and an
// explicit null or "" clears description/head. Whether the head is an active employee of
// the company is checked by the service (same message).
const departmentSchema = Joi.object({
  name: noEmoji(Joi.string().trim().min(2).max(150))
    .required()
    .messages({
      ...required("departmentNameRequired"),
      "string.min": "departmentNameMin",
      "string.max": "departmentNameMax",
      "string.pattern.invert.base": "departmentNameNoEmoji",
    }),
  code: noEmoji(Joi.string().trim().uppercase().max(50))
    .required()
    .messages({
      ...required("departmentCodeRequired"),
      "string.max": "departmentCodeMax",
      "string.pattern.invert.base": "departmentCodeNoEmoji",
    }),
  description: noEmoji(Joi.string().trim().max(2000))
    .allow("", null)
    .messages({
      "string.base": INVALID,
      "string.max": "descriptionMax",
      "string.pattern.invert.base": "descriptionNoEmoji",
    }),
  deptHeadId: Joi.string()
    .trim()
    .guid()
    .allow("", null)
    .messages({ "string.base": "departmentHeadInvalid", "string.guid": "departmentHeadInvalid" }),
  status: Joi.string()
    .valid(...STATUSES)
    .messages({ "string.base": INVALID, "string.empty": INVALID, "any.only": INVALID }),
});

// GET /departments?page=&limit=&search=&status= ("" status = all).
const listDepartmentsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": INVALID,
    "number.integer": INVALID,
    "number.min": INVALID,
    "number.unsafe": INVALID,
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.base": INVALID,
    "number.integer": INVALID,
    "number.min": INVALID,
    "number.max": INVALID,
    "number.unsafe": INVALID,
  }),
  search: Joi.string().trim().max(150).allow("").default("").messages({ "string.base": INVALID, "string.max": INVALID }),
  status: Joi.string()
    .valid(...STATUSES)
    .allow("")
    .default("")
    .messages({ "string.base": INVALID, "any.only": INVALID }),
});

module.exports = { departmentSchema, listDepartmentsSchema };
