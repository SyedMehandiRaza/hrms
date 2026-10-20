const Joi = require("joi");
const { INVALID } = require("./department.validation");

// POST /projects/:id/employees { employeeIds } (standards §7.2 "Project assign", workforce D13).
const assignSchema = Joi.object({
  employeeIds: Joi.array()
    .items(Joi.string().trim())
    .min(1)
    .unique()
    .required()
    .messages({
      "any.required": "assignSelectEmployee",
      "array.base": "assignSelectEmployee",
      "array.min": "assignSelectEmployee",
      "array.unique": INVALID,
      "string.base": INVALID,
      "string.empty": INVALID,
    }),
});

const paging = {
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
};

// GET /projects/:id/employees?search=&status=&page=&limit= (status ACTIVE | IN_NOTICE).
const workforceSchema = Joi.object({
  ...paging,
  status: Joi.string().valid("ACTIVE", "IN_NOTICE").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
});

// GET /projects/:id/assignable-employees?search=&page=&limit=
const assignableSchema = Joi.object(paging);

module.exports = { assignSchema, workforceSchema, assignableSchema };
