const Joi = require("joi");
const { required, INVALID } = require("./department.validation");

// Salary components (standards §7.2 "Salary component", workforce D41, D43). The code is the
// server's (from the name) and is never accepted.
const EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

const salaryComponentSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(EMOJI, { invert: true })
    .required()
    .messages({
      ...required("componentNameRequired"),
      "string.min": "componentNameLength",
      "string.max": "componentNameLength",
      "string.pattern.invert.base": "emojisNotAllowed",
    }),
  type: Joi.string()
    .valid("EARNING", "DEDUCTION")
    .required()
    .messages({ ...required("componentTypeRequired"), "any.only": "componentTypeRequired" }),
  description: Joi.string().trim().max(255).allow("", null).messages({ "string.base": INVALID, "string.max": "descriptionMax255" }),
  status: Joi.string().valid("ACTIVE", "INACTIVE").messages({ "string.base": INVALID, "string.empty": INVALID, "any.only": INVALID }),
});

// GET /salary-components?page=&limit=&search=&type=&status=
const listSalaryComponentsSchema = Joi.object({
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
  type: Joi.string().valid("EARNING", "DEDUCTION").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
  status: Joi.string().valid("ACTIVE", "INACTIVE").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
});

module.exports = { salaryComponentSchema, listSalaryComponentsSchema };
