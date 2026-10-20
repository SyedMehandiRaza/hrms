const Joi = require("joi");
const { INVALID, STATUSES } = require("./department.validation");

// GET /staffing-companies?status= ("" or absent = all).
const listStaffingCompaniesSchema = Joi.object({
  status: Joi.string()
    .valid(...STATUSES)
    .allow("")
    .default("")
    .messages({ "string.base": INVALID, "any.only": INVALID }),
});

module.exports = { listStaffingCompaniesSchema };
