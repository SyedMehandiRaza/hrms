const ErrorHandler = require("../utils/ErrorHandler");

// validate(schema) checks req.body; validate(schema, "query") checks req.query.
const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: true, stripUnknown: true });
    if (error) {
      return next(new ErrorHandler(400, error.details[0].message));
    }
    if (source === "query") {
      Object.defineProperty(req, "query", { value, writable: true, configurable: true });
    } else {
      req[source] = value;
    }
    return next();
  };

module.exports = validate;
