const Joi = require("joi");

// Password rule wherever a password is set (standards §1): 8–72 characters with an
// uppercase letter, a lowercase letter, a digit and a special character (anything
// that is not a letter or digit). 72 is the bcrypt input limit.
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/s;

// TLDs are not checked (e.g. the dev/test domain hrms.test).
const email = () =>
  Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required().messages({
    "any.required": "emailRequired",
    "string.empty": "emailRequired",
    "string.base": "emailRequired",
    "string.email": "emailInvalid",
  });

// Login only checks that a password is present, never its format (standards §1).
const loginSchema = Joi.object({
  email: email(),
  password: Joi.string().required().messages({
    "any.required": "passwordRequired",
    "string.empty": "passwordRequired",
    "string.base": "passwordRequired",
  }),
});

// POST /auth/signup (standards §7.2 "Sign up"). Phone is optional, digits only, 6–15
// (same rule as the company profile, D28); an empty phone counts as not given.
// A missing password gets the password-rule text: the form has no separate "required" message.
const signupSchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "companyNameRequired",
    "string.empty": "companyNameRequired",
    "string.base": "companyNameRequired",
    "string.min": "companyNameMin",
    "string.max": "companyNameMax",
  }),
  name: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "nameRequired",
    "string.empty": "nameRequired",
    "string.base": "nameRequired",
    "string.min": "nameMin",
    "string.max": "nameMax",
  }),
  email: email(),
  phone: Joi.string()
    .trim()
    .empty(["", null])
    .pattern(/^\d{6,15}$/)
    .messages({ "string.base": "phoneInvalid", "string.pattern.base": "phoneInvalid" }),
  password: Joi.string().pattern(PASSWORD_RULE).required().messages({
    "any.required": "AUTH_PASSWORD_WEAK",
    "string.empty": "AUTH_PASSWORD_WEAK",
    "string.base": "AUTH_PASSWORD_WEAK",
    "string.pattern.base": "AUTH_PASSWORD_WEAK",
  }),
  // custom() rather than valid(ref): it runs after the type/empty checks, so "" or a
  // non-string never "matches" an equally empty or non-string password.
  confirmPassword: Joi.string()
    .required()
    .custom((value, helpers) => (value === helpers.state.ancestors[0].password ? value : helpers.error("any.only")))
    .messages({
      "any.required": "confirmPasswordRequired",
      "string.empty": "confirmPasswordRequired",
      "string.base": "confirmPasswordRequired",
      "any.only": "AUTH_PASSWORD_MISMATCH",
    }),
});

module.exports = { loginSchema, signupSchema, PASSWORD_RULE };
