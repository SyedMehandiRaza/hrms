const ErrorHandler = require("../utils/ErrorHandler");
const { MESSAGES } = require("../constants/messages");
const { fieldErrorsFromJoi } = require("../utils/fieldErrors");

// validate(schema) checks req.body; validate(schema, "query") checks req.query.
// Reports every invalid field at once: 400 VALIDATION_FAILED with an `errors` map.
// With { singleFieldCode: true }, when exactly one field fails and its message key
// is an error code (e.g. COMPANY_TIMEZONE_INVALID), that code is the response code;
// the field keeps the same text in `errors` (like AUTH_PASSWORD_SAME).
const validate =
  (schema, source = "body", { singleFieldCode = false } = {}) =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      const errors = fieldErrorsFromJoi(error);
      const keys = Object.values(errors);
      const code = singleFieldCode && keys.length === 1 && MESSAGES[keys[0]] ? keys[0] : "VALIDATION_FAILED";
      return next(new ErrorHandler(code, { errors }));
    }
    if (source === "query") {
      Object.defineProperty(req, "query", { value, writable: true, configurable: true });
    } else {
      req[source] = value;
    }
    return next();
  };

module.exports = validate;
