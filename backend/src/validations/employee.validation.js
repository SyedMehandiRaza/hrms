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

// A repeated id is reported on the list itself (Joi's unique() reports it on the item).
const noRepeats = (ids, helpers) => (new Set(ids).size === ids.length ? ids : helpers.error("array.repeat"));

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

// Salary rows { componentId, calculationType (FIXED | PERCENTAGE, default FIXED), amount ≥ 0 },
// checked as one field so every message is reported under `components` (D52). Which components
// exist and are active is checked by the service.
const CALCULATION_TYPES = ["FIXED", "PERCENTAGE"];
const componentRows = Joi.array()
  .items(Joi.any())
  .default([])
  .custom((rows, helpers) => {
    const seen = new Set();
    const out = [];
    for (const row of rows) {
      if (!row || typeof row !== "object" || typeof row.componentId !== "string" || !row.componentId.trim()) return helpers.error("rows.invalid");
      const calculationType = row.calculationType ?? "FIXED";
      if (!CALCULATION_TYPES.includes(calculationType)) return helpers.error("rows.invalid");
      if (typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount < 0) return helpers.error("rows.amount");
      const componentId = row.componentId.trim();
      if (seen.has(componentId)) return helpers.error("rows.duplicate");
      seen.add(componentId);
      out.push({ componentId, calculationType, amount: row.amount });
    }
    return out;
  })
  .messages({ "array.base": INVALID, "rows.invalid": INVALID, "rows.amount": "amountEveryRow", "rows.duplicate": "duplicateComponent" });

const SALARY_MODES = ["MONTHLY_FIXED", "MONTHLY_HOURLY", "HOURLY"];
const number = (key) => Joi.number().empty(["", null]).messages({ "number.base": key, "number.min": key, "number.max": key, "number.greater": key, "number.multiple": key, "number.unsafe": key, "any.required": key });

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
    .custom(noRepeats)
    .required()
    .messages({ "any.required": "projectRequired", "array.base": "projectRequired", "array.min": "projectRequired", "array.repeat": INVALID }),
  mainProjectId: Joi.string().trim().required().messages(required("mainProjectRequired")),
  joiningDate,
  departmentId: optionalId(),
  designationId: optionalId(),
  staffingCompanyId: optionalId(),
  approvalGroupId: optionalId("approvalGroupRequired"),
  // Leave, shift, salary (13b; D33, D40, D52).
  leavePolicyIds: Joi.array()
    .items(id)
    .min(1)
    .custom(noRepeats)
    .required()
    .messages({ "any.required": "leavePolicyRequired", "array.base": "leavePolicyRequired", "array.min": "leavePolicyRequired", "array.repeat": "leavePolicyPerType" }),
  shiftId: optionalId(),
  currency: Joi.string().trim().uppercase().valid("SAR").default("SAR").messages({ "string.base": "currencySar", "string.empty": "currencySar", "any.only": "currencySar" }),
  salaryMode: Joi.string()
    .valid(...SALARY_MODES)
    .required()
    .messages({ ...required("salaryModeInvalid"), "any.only": "salaryModeInvalid" }),
  workingHours: number("workingHours").greater(0).max(24).when("salaryMode", { is: "MONTHLY_HOURLY", then: Joi.required() }),
  hourlyRate: number("hourlyRate").greater(0).when("salaryMode", { is: "HOURLY", then: Joi.required() }),
  minHours: number("minHours").min(0),
  overtimeRate: number("overtimeRate").min(1).max(5).multiple(0.5),
  components: componentRows,
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

module.exports = { createEmployeeSchema, checkUniqueSchema, ACCESS_LEVELS, SALARY_MODES };
