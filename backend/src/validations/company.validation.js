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

module.exports = { updateCompanySchema };
