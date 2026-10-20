const Joi = require("joi");
const { required, INVALID } = require("./department.validation");
const { phoneFields } = require("../utils/phone");

// POST /offices and PUT /offices/:id (standards §7.2 "Head office", workforce D5, countries D7).
// Same rules as the UI's CreateHeadOffice form. On edit, omitted optional fields keep their
// values and an explicit null/"" clears them. Whether the country/city exist is checked by the
// service (same messages).
const officeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/\s{2,}/, { invert: true, name: "spaces" })
    .pattern(/^[A-Za-z0-9']+(?:\s[A-Za-z0-9']+)*$/, { name: "chars" })
    .required()
    .messages({
      ...required("officeNameRequired"),
      "string.min": "min2CharsRequired",
      "string.max": "officeNameMax",
      "string.pattern.invert.name": "multipleSpaces",
      "string.pattern.name": "officeNameChars",
    }),
  email: Joi.string()
    .trim()
    .lowercase()
    .max(255)
    .email({ tlds: { allow: false } })
    .required()
    .messages({ ...required("emailRequired"), "string.email": "emailValidAddress", "string.max": "emailValidAddress" }),
  ...phoneFields({ required: true, requiredKey: "phoneNumberRequired" }),
  location: Joi.string()
    .trim()
    .min(3)
    .max(255)
    .pattern(/^[A-Za-z0-9,\s-]+$/)
    .required()
    .messages({
      ...required("locationRequired"),
      "string.min": "min3Chars",
      "string.max": "max255Allowed",
      "string.pattern.base": "locationFormat",
    }),
  latitude: Joi.number().min(-90).max(90).allow(null, "").messages({
    "number.base": "latitudeInvalid",
    "number.min": "latitudeInvalid",
    "number.max": "latitudeInvalid",
  }),
  longitude: Joi.number().min(-180).max(180).allow(null, "").messages({
    "number.base": "longitudeInvalid",
    "number.min": "longitudeInvalid",
    "number.max": "longitudeInvalid",
  }),
  countryId: Joi.string().trim().required().messages(required("countryRequired")),
  cityId: Joi.string().trim().allow(null, "").messages({ "string.base": "cityNotInCountry" }),
});

// GET /offices?page=&limit=&search=&status= (status: ACTIVE = has a project, UNASSIGNED = none).
const listOfficesSchema = Joi.object({
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
  status: Joi.string().valid("ACTIVE", "UNASSIGNED").allow("").default("").messages({ "string.base": INVALID, "any.only": INVALID }),
});

module.exports = { officeSchema, listOfficesSchema };
