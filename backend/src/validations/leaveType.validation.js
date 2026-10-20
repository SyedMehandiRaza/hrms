const Joi = require("joi");
const { required, INVALID } = require("./department.validation");
const { isRealDate } = require("./dates");

// Leave types with their one policy, edited together (standards §7.2 "Leave type / policy",
// workforce D30–D32). POST and PUT take the whole form; omitted flags take their defaults.
const EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
const yesNo = (fallback) => Joi.boolean().default(fallback).messages({ "boolean.base": "yesNo" });
const optionalDate = (key) =>
  Joi.string()
    .trim()
    .custom((value, helpers) => (isRealDate(value) ? value : helpers.error("date.invalid")))
    .allow("", null)
    .messages({ "string.base": key, "date.invalid": key });

const leaveTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(EMOJI, { invert: true })
    .required()
    .messages({
      ...required("leaveNameRequired"),
      "string.min": "mustMin2Chars",
      "string.max": "max150Chars",
      "string.pattern.invert.base": "emojisNotAllowed",
    }),
  code: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9]{1,10}$/)
    .required()
    .messages({ ...required("leaveCodeRequired"), "string.pattern.base": "leaveCodeFormat" }),
  description: Joi.string().trim().max(2000).allow("", null).messages({ "string.base": INVALID, "string.max": INVALID }),
  is_paid: yesNo(true),
  allow_half_day: yesNo(true),
  requires_document: yesNo(false),
  allow_negative_balance: yesNo(false),
  prorate_joiners: yesNo(true),
  is_active: yesNo(true),
  yearly_quota: Joi.number().min(0).max(365).required().messages({
    "any.required": "quotaRange",
    "number.base": "quotaRange",
    "number.min": "quotaRange",
    "number.max": "quotaRange",
  }),
  accrual_method: Joi.string()
    .valid("MONTHLY_ACCRUAL", "UPFRONT")
    .required()
    .messages({ "any.required": "accrualMethodRequired", "string.base": "accrualMethodRequired", "any.only": "accrualMethodRequired" }),
  // Ignored for UPFRONT (D31).
  monthly_accrual: Joi.number().min(0).default(0).messages({ "number.base": "monthlyAccrualNegative", "number.min": "monthlyAccrualNegative" }),
  // Default: the start of the current financial year (D31).
  effective_from: optionalDate("effectiveToAfter"),
  effective_to: optionalDate("effectiveToAfter")
    .custom((value, helpers) => {
      const from = helpers.state.ancestors[0].effective_from;
      return value && from && isRealDate(String(from).trim()) && value <= String(from).trim() ? helpers.error("date.notAfter") : value;
    })
    .messages({ "date.notAfter": "effectiveToAfter" }),
  allow_carry_forward: yesNo(false),
  max_carry_forward_days: Joi.number()
    .default(0)
    .when("allow_carry_forward", { is: true, then: Joi.number().greater(0).required() })
    .messages({ "any.required": "maxCarryForward", "number.base": "maxCarryForward", "number.greater": "maxCarryForward" }),
  carry_forward_expiry_months: Joi.number().integer().min(0).max(36).default(0).messages({
    "number.base": "carryExpiry",
    "number.integer": "carryExpiry",
    "number.min": "carryExpiry",
    "number.max": "carryExpiry",
  }),
  allow_encashment: yesNo(false),
  max_encashment_days: Joi.number()
    .default(0)
    .when("allow_encashment", { is: true, then: Joi.number().greater(0).required() })
    .messages({ "any.required": "maxEncashment", "number.base": "maxEncashment", "number.greater": "maxEncashment" }),
  year_end_excess: Joi.string()
    .valid("LAPSE", "ENCASH")
    .default("LAPSE")
    .messages({ "string.base": "yearEndExcess", "any.only": "yearEndExcess" }),
});

// GET /leave-types?page=&limit=&search=&status=
const listLeaveTypesSchema = Joi.object({
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
  status: Joi.string().valid("ACTIVE", "INACTIVE").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
});

module.exports = { leaveTypeSchema, listLeaveTypesSchema };
