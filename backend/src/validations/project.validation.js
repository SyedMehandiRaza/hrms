const Joi = require("joi");
const { required, INVALID } = require("./department.validation");

// Projects (standards §7.2 "Project", workforce D7–D12, countries D7). Same rules as the UI's
// hrms/src/utils/projectRules.js.

// Letters/digits in any script (Arabic…) plus - & , ( ) ' ’ . / : # and single spaces.
const PROJECT_NAME_PATTERN = /^[\p{L}\p{M}\p{N}\s\-&,()'’./:#]+$/u;
const STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const date = (key) =>
  Joi.string()
    .trim()
    .pattern(DATE)
    .custom((value, helpers) => (Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? helpers.error("date.invalid") : value))
    .required()
    .messages({ ...required(key), "string.pattern.base": key, "date.invalid": key });

const status = () =>
  Joi.string()
    .valid(...STATUSES)
    .messages({ "string.base": "statusChangeNotAllowed", "string.empty": "statusChangeNotAllowed", "any.only": "statusChangeNotAllowed" });

// POST /projects and PUT /projects/:id. On edit, omitted optional fields keep their values;
// an explicit null/"" clears description and city. The code is never accepted.
const projectSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/\s{2,}/, { invert: true, name: "spaces" })
    .pattern(PROJECT_NAME_PATTERN, { name: "chars" })
    .required()
    .messages({
      ...required("projectNameRequired"),
      "string.min": "min2CharsRequired",
      "string.max": "projectNameMax",
      "string.pattern.invert.name": "multipleSpaces",
      "string.pattern.name": "invalidCharsUsed",
    }),
  officeId: Joi.string().trim().required().messages(required("officeSelect")),
  startDate: date("startDateRequired"),
  // On or after the start (D11).
  endDate: date("endDateRequired")
    .custom((value, helpers) => {
      const start = String(helpers.state.ancestors[0].startDate || "").trim();
      return DATE.test(start) && value < start ? helpers.error("date.beforeStart") : value;
    })
    .messages({ "date.beforeStart": "endAfterStart" }),
  location: Joi.string().trim().max(255).required().messages({ ...required("mapLocationRequired"), "string.max": "mapLocationRequired" }),
  latitude: Joi.number().min(-90).max(90).required().messages({
    "any.required": "mapLocationRequired",
    "number.base": "mapLocationRequired",
    "number.min": "mapLocationRequired",
    "number.max": "mapLocationRequired",
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    "any.required": "mapLocationRequired",
    "number.base": "mapLocationRequired",
    "number.min": "mapLocationRequired",
    "number.max": "mapLocationRequired",
  }),
  radius: Joi.number().min(50).max(100000).required().messages({
    "any.required": "radiusRequired",
    "number.base": "radiusRequired",
    "number.min": "radiusMin",
    "number.max": "radiusMax",
  }),
  allowOfflineAttendance: Joi.boolean().messages({ "boolean.base": INVALID }),
  description: Joi.string().trim().max(1000).allow("", null).messages({ "string.base": INVALID, "string.max": "descriptionMax1000" }),
  countryId: Joi.string().trim().required().messages(required("countryRequired")),
  cityId: Joi.string().trim().allow(null, "").messages({ "string.base": "cityNotInCountry" }),
  status: status(),
});

// PATCH /projects/:id/status
const statusSchema = Joi.object({ status: status().required().messages({ "any.required": "statusChangeNotAllowed" }) });

// GET /projects?page=&limit=&search=&status=
const listProjectsSchema = Joi.object({
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
  status: Joi.string()
    .valid(...STATUSES)
    .allow("")
    .default("")
    .messages({ "string.base": INVALID, "any.only": INVALID }),
});

// GET /projects/office-options?projectId=
const officeOptionsSchema = Joi.object({
  projectId: Joi.string().trim().allow("").default("").messages({ "string.base": INVALID }),
});

module.exports = { projectSchema, statusSchema, listProjectsSchema, officeOptionsSchema, STATUSES, PROJECT_NAME_PATTERN };
