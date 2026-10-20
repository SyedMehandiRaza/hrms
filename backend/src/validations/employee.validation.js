const Joi = require("joi");
const { required, INVALID } = require("./department.validation");
const { phoneFields } = require("../utils/phone");
const { isRealDate } = require("./dates");

// POST /employees (standards §7.2 "Employee (create, edit)", workforce D45–D51; countries D12–D19).
// Whether ids exist, are active and belong to the company is checked by the service. Leave,
// shift and salary at create come with ticket 13b.
const ACCESS_LEVELS = ["EMPLOYEE", "GENERAL_EMPLOYEE", "SUB_ADMIN"];
// ADMIN passes here so the service can answer ACCOUNT_ADMIN_EXISTS (D48).
const ACCEPTED_ACCESS_LEVELS = [...ACCESS_LEVELS, "ADMIN"];

const id = Joi.string().trim().messages({ "string.base": INVALID });
const optionalId = (key = INVALID) => Joi.string().trim().empty(["", null]).messages({ "string.base": key });

const name = Joi.string()
  .trim()
  .min(2)
  .max(255)
  .pattern(/\s{2,}/, { invert: true, name: "spaces" })
  .required()
  .messages({ ...required("fullNameRequired"), "string.min": "min2CharsRequired", "string.max": INVALID, "string.pattern.invert.name": "multipleSpaces" });

const countryEmpId = Joi.string()
  .trim()
  .uppercase()
  .min(3)
  .max(10)
  .pattern(/^[A-Z0-9-]+$/)
  .messages({ ...required("countryEmpIdRequired"), "string.min": "min3CharsRequired", "string.max": "max10OrLess", "string.pattern.base": "idChars" });

const email = Joi.string()
  .trim()
  .lowercase()
  .max(255)
  .email({ tlds: { allow: false } })
  .messages({ ...required("emailAddressRequired"), "string.email": "emailValidAddress", "string.max": "emailValidAddress" });

const joiningDate = Joi.string()
  .trim()
  .empty(["", null])
  .custom((value, helpers) => (isRealDate(value) ? value : helpers.error("date.invalid")))
  .messages({ "string.base": INVALID, "date.invalid": INVALID });

const createEmployeeSchema = Joi.object({
  name,
  country_emp_id: countryEmpId.required(),
  email: email.required(),
  ...phoneFields({ required: true, requiredKey: "phoneNumberRequired" }),
  nationalityCountryId: Joi.string().trim().required().messages(required("nationalityRequired")),
  residenceCountryId: optionalId("countryRequired"),
  residenceCityId: optionalId("cityNotInCountry"),
  dob: joiningDate,
  gender: Joi.string().valid("MALE", "FEMALE", "OTHER").empty(["", null]).messages({ "string.base": INVALID, "any.only": INVALID }),
  address: Joi.string().trim().max(2000).empty(["", null]).messages({ "string.base": INVALID, "string.max": INVALID }),
  accommodation: Joi.string().trim().max(255).empty(["", null]).messages({ "string.base": INVALID, "string.max": INVALID }),
  employmentType: Joi.string()
    .valid("FULL_TIME", "CONTRACT")
    .required()
    .messages({ ...required("employmentTypeRequired"), "any.only": "employmentTypeRequired" }),
  accessLevel: Joi.string()
    .valid(...ACCEPTED_ACCESS_LEVELS)
    .required()
    .messages({ ...required("accessLevelRequired"), "any.only": "accessLevelInvalid" }),
  roleId: optionalId(),
  projectIds: Joi.array()
    .items(id)
    .min(1)
    .unique()
    .required()
    .messages({ "any.required": "projectRequired", "array.base": "projectRequired", "array.min": "projectRequired", "array.unique": INVALID }),
  mainProjectId: Joi.string().trim().required().messages(required("mainProjectRequired")),
  joiningDate,
  departmentId: optionalId(),
  designationId: optionalId(),
  staffingCompanyId: optionalId(),
  approvalGroupId: optionalId("approvalGroupRequired"),
  moduleKey: Joi.string().trim().default("ALL").messages({ "string.base": INVALID }),
  draft_id: optionalId(),
});

// GET /employees/check-unique?country_emp_id=&email=&phone=&phoneCountry= (D46): only the given
// fields are checked.
const checkUniqueSchema = Joi.object({
  country_emp_id: countryEmpId.empty(""),
  email: email.empty(""),
  ...phoneFields({ required: false }),
});

module.exports = { createEmployeeSchema, checkUniqueSchema, ACCESS_LEVELS };
