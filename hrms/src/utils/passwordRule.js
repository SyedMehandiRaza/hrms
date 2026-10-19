// The password rule wherever a password is set (sign up, reset, set, change) —
// the same rule as the backend's PASSWORD_RULE (backend/src/validations/auth.validation.js,
// standards §1): 8–72 characters with an uppercase letter, a lowercase letter, a
// digit and a special character (anything that is not a letter or digit).
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/s;

export const isStrongPassword = (value) => typeof value === "string" && PASSWORD_RULE.test(value);
