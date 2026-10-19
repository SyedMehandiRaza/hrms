const Joi = require("joi");

// TLDs are not checked (e.g. the dev/test domain hrms.test).
// Login only checks that a password is present, never its format (standards §1).
const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required().messages({
    "any.required": "emailRequired",
    "string.empty": "emailRequired",
    "string.base": "emailRequired",
    "string.email": "emailInvalid",
  }),
  password: Joi.string().required().messages({
    "any.required": "passwordRequired",
    "string.empty": "passwordRequired",
    "string.base": "passwordRequired",
  }),
});

module.exports = { loginSchema };
