const ErrorHandler = require("../utils/ErrorHandler");
const { fieldErrorsFromJoi } = require("../utils/fieldErrors");

// validate(schema) checks req.body; validate(schema, "query") checks req.query.
// Reports every invalid field at once: 400 VALIDATION_FAILED with an `errors` map.
const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      return next(new ErrorHandler("VALIDATION_FAILED", { errors: fieldErrorsFromJoi(error) }));
    }
    if (source === "query") {
      Object.defineProperty(req, "query", { value, writable: true, configurable: true });
    } else {
      req[source] = value;
    }
    return next();
  };

module.exports = validate;
