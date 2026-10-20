const Joi = require("joi");
const { INVALID } = require("./department.validation");

// GET /countries/:id/cities?search=&page=&limit= (countries-cities-phones D9): 20 per page by default.
const listCitiesSchema = Joi.object({
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

module.exports = { listCitiesSchema };
