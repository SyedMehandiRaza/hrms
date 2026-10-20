const Joi = require("joi");
const { INVALID } = require("./department.validation");
const { isRealDate } = require("./dates");

// Week-offs (standards §7.2 "Week-offs", workforce D38, D39).

// PUT /shifts/:id/week-offs { financialYearId, dates }: the shown year's off days.
const saveWeekOffsSchema = Joi.object({
  financialYearId: Joi.string().trim().required().messages({ "any.required": INVALID, "string.base": INVALID, "string.empty": INVALID }),
  // Every item a real "YYYY-MM-DD" day, reported under `dates` (not `dates.<n>`).
  dates: Joi.array()
    .unique()
    .custom((value, helpers) => (value.every(isRealDate) ? value : helpers.error("dates.invalid")))
    .required()
    .messages({
      "any.required": "weekOffOutsideFy",
      "array.base": "weekOffOutsideFy",
      "array.unique": "weekOffOutsideFy",
      "dates.invalid": "weekOffOutsideFy",
    }),
});

// GET /shifts/:id/week-offs?financialYearId=
const getWeekOffsSchema = Joi.object({
  financialYearId: Joi.string().trim().allow("").default("").messages({ "string.base": INVALID }),
});

// GET /shifts/week-offs/copy-preview?to_fy= and POST /shifts/week-offs/copy { to_fy, shift_ids }.
const copyPreviewSchema = Joi.object({
  to_fy: Joi.string().trim().allow("").default("").messages({ "string.base": INVALID }),
});
const copySchema = Joi.object({
  to_fy: Joi.string().trim().allow("").default("").messages({ "string.base": INVALID }),
  shift_ids: Joi.array()
    .items(Joi.string().trim())
    .min(1)
    .unique()
    .required()
    .messages({ "any.required": INVALID, "array.base": INVALID, "array.min": INVALID, "array.unique": INVALID, "string.base": INVALID }),
});

module.exports = { saveWeekOffsSchema, getWeekOffsSchema, copyPreviewSchema, copySchema };
