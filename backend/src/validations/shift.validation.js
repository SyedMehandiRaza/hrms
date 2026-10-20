const Joi = require("joi");
const { required, INVALID } = require("./department.validation");
const { isRealDate } = require("./dates");

// Shifts (standards §7.2 "Shift", workforce D35–D37). The field keys are the form's
// (start_time, end_time, effective_from). Times are "HH:MM" (or "HH:MM:SS"); an end before the
// start is an overnight shift; equal times are refused.
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const time = (key) => Joi.string().trim().pattern(TIME).required().messages({ ...required(key), "string.pattern.base": key });
const hhmm = (value) => String(value || "").trim().slice(0, 5);

const shiftSchema = Joi.object({
  name: Joi.string().trim().max(50).required().messages({ ...required("shiftNameRequired"), "string.max": "shiftNameMax" }),
  start_time: time("startTimeRequired"),
  end_time: time("endTimeRequired")
    .custom((value, helpers) =>
      TIME.test(String(helpers.state.ancestors[0].start_time || "").trim()) && hhmm(value) === hhmm(helpers.state.ancestors[0].start_time)
        ? helpers.error("time.same")
        : value
    )
    .messages({ "time.same": "endTimeSameAsStart" }),
  // When the times change: the day the new times apply from (default today, D36).
  effective_from: Joi.string()
    .trim()
    .pattern(DATE)
    .custom((value, helpers) => (isRealDate(value) ? value : helpers.error("date.invalid")))
    .allow("", null)
    .messages({
      "string.base": "shiftEffectiveFromInvalid",
      "string.pattern.base": "shiftEffectiveFromInvalid",
      "date.invalid": "shiftEffectiveFromInvalid",
    }),
});

// GET /shifts?page=&limit=&search=
const listShiftsSchema = Joi.object({
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
});

module.exports = { shiftSchema, listShiftsSchema };
