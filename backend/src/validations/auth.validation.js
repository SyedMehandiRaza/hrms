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

// POST /auth/forgot-password (standards §7.2 "Forgot": email as Login).
const forgotPasswordSchema = Joi.object({ email: email() });

// POST /auth/verify-otp: the 6-digit code as a string (standards §7.2 "Verify OTP").
const verifyOtpSchema = Joi.object({
  email: email(),
  otp: Joi.string().trim().pattern(/^\d{6}$/).required().messages({
    "any.required": "otpIncomplete",
    "string.empty": "otpIncomplete",
    "string.base": "otpIncomplete",
    "string.pattern.base": "otpIncomplete",
  }),
});

// Confirmation of a new password: required, then equal to newPassword.
const confirmNewPassword = () =>
  Joi.string()
    .required()
    .custom((value, helpers) => (value === helpers.state.ancestors[0].newPassword ? value : helpers.error("any.only")))
    .messages({
      "any.required": "confirmPasswordRequired",
      "string.empty": "confirmPasswordRequired",
      "string.base": "confirmPasswordRequired",
      "any.only": "AUTH_PASSWORD_MISMATCH",
    });

// POST /auth/reset-password (standards §7.2 "Reset / Set / Change password"). The reset
// token has no field on the form: a missing or malformed one is AUTH_RESET_TOKEN_INVALID,
// answered by the service, so it is let through here.
const resetPasswordSchema = Joi.object({
  resetToken: Joi.any(),
  newPassword: Joi.string().pattern(PASSWORD_RULE).required().messages({
    "any.required": "passwordRequired",
    "string.empty": "passwordRequired",
    "string.base": "passwordRequired",
    "string.pattern.base": "AUTH_PASSWORD_WEAK",
  }),
  confirmPassword: confirmNewPassword(),
});

// POST /auth/setup-password (standards §7.2 "Reset / Set / Change password"). Like the
// reset token, the setup token has no field on the form: a missing or malformed one is
// AUTH_SETUP_LINK_INVALID, answered by the service.
const setupPasswordSchema = Joi.object({
  token: Joi.any(),
  newPassword: resetPasswordSchema.extract("newPassword"),
  confirmPassword: confirmNewPassword(),
});

module.exports = {
  loginSchema,
  setupPasswordSchema,
  signupSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  PASSWORD_RULE,
  email,
};
