const Joi = require("joi");
const { listDepartmentsSchema, noEmoji, required, INVALID, STATUSES } = require("./department.validation");

// POST /departments/:id/designations and PUT /designations/:id (standards §7.2 "Designation", D32).
// name is always required; code is optional (uppercased; "" or null = no code). On create,
// missing optional fields get their defaults (code/description null, status ACTIVE); on edit
// they keep their current values. department_id/departmentId are not keys here, so
// validate() strips them: a designation can't move to another department.
const designationSchema = Joi.object({
  name: noEmoji(Joi.string().trim().min(2).max(150))
    .required()
    .messages({
      ...required("designationNameRequired"),
      "string.min": "designationNameMin",
      "string.max": "designationNameMax",
      "string.pattern.invert.base": "designationNameNoEmoji",
    }),
  code: noEmoji(Joi.string().trim().uppercase().max(50))
    .allow("", null)
    .messages({
      "string.base": INVALID,
      "string.max": "designationCodeMax",
      "string.pattern.invert.base": "designationCodeNoEmoji",
    }),
  description: noEmoji(Joi.string().trim().max(2000))
    .allow("", null)
    .messages({
      "string.base": INVALID,
      "string.max": "descriptionMax",
      "string.pattern.invert.base": "descriptionNoEmoji",
    }),
  status: Joi.string()
    .valid(...STATUSES)
    .messages({ "string.base": INVALID, "string.empty": INVALID, "any.only": INVALID }),
});

// GET /departments/:id/designations?page=&limit=&search=&status= — same rules as the departments list.
const listDesignationsSchema = listDepartmentsSchema;

// GET /designations?departmentId= (dropdown; "" = every department).
const designationOptionsSchema = Joi.object({
  departmentId: Joi.string().trim().guid().allow("").default("").messages({ "string.base": INVALID, "string.guid": INVALID }),
});

module.exports = { designationSchema, listDesignationsSchema, designationOptionsSchema };
