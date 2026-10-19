const Joi = require("joi");

// Message keys for "missing": absent, blank after trimming, or not a string.
const required = (key) => ({ "any.required": key, "string.empty": key, "string.base": key });

// PUT /company (standards §7.2 "Company profile", D28). Every field is required.
// Whether the industry exists is checked by the service (same message).
const updateCompanySchema = Joi.object({
  companyName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({ ...required("companyNameRequired"), "string.min": "companyNameMin", "string.max": "companyNameMax" }),
  industryTypeId: Joi.string().trim().max(36).required().messages({ ...required("industryRequired"), "string.max": "industryRequired" }),
  // TLDs are not checked (e.g. the dev/test domain hrms.test), as for the login email.
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255)
    .required()
    .messages({ ...required("emailRequired"), "string.email": "emailEnterValid", "string.max": "emailEnterValid" }),
  phone: Joi.string()
    .trim()
    .pattern(/^\d{6,15}$/)
    .required()
    .messages({ ...required("phoneRequired"), "string.pattern.base": "phoneDigits" }),
  address: Joi.string()
    .trim()
    .max(500)
    .required()
    .messages({ ...required("addressRequired"), "string.max": "addressMax" }),
});

// A valid IANA zone name (D30): one Intl knows, e.g. "Europe/London", "UTC" or an
// alias such as "Asia/Kolkata" (Node lists the older "Asia/Calcutta"). Offsets such
// as "+03:00" are not zone names. A wrong-case name is stored with its real case.
const ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;
const normalizeTimezone = (value) => {
  if (!ZONE_NAME.test(value)) return null;
  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
    return resolved.toLowerCase() === value.toLowerCase() ? resolved : value;
  } catch {
    return null;
  }
};

const TIMEZONE_INVALID = "COMPANY_TIMEZONE_INVALID";
const FY_START_INVALID = "COMPANY_FY_START_INVALID";

// PATCH /company/time-settings (D30, standards §7.2 "Time settings"). Only these two
// fields are read; anything else (e.g. lock_mode) is stripped by validate(). Each
// field's message key is its own error code, so one bad field answers with that code
// (validate's singleFieldCode). Sending neither field is checked by the service.
const updateTimeSettingsSchema = Joi.object({
  timezone: Joi.string()
    .trim()
    .max(64)
    .custom((value, helpers) => normalizeTimezone(value) || helpers.error("any.invalid"))
    .messages({
      "string.base": TIMEZONE_INVALID,
      "string.empty": TIMEZONE_INVALID,
      "string.max": TIMEZONE_INVALID,
      "any.invalid": TIMEZONE_INVALID,
    }),
  fy_start_month: Joi.number().integer().min(1).max(12).messages({
    "number.base": FY_START_INVALID,
    "number.integer": FY_START_INVALID,
    "number.min": FY_START_INVALID,
    "number.max": FY_START_INVALID,
    "number.unsafe": FY_START_INVALID,
    "number.infinity": FY_START_INVALID,
  }),
});

module.exports = { updateCompanySchema, updateTimeSettingsSchema };
