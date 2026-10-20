const ErrorHandler = require("../utils/ErrorHandler");
const { resolveLang, translate } = require("../utils/i18n");

// Single global error middleware. Answers { success: false, code, message, errors? }
// with message (and field messages) in the caller's language. Never leaks raw
// errors or stack traces; unexpected errors are logged on the server.
const errorHandler = (err, req, res, next) => {
  const lang = req.lang || resolveLang(req.headers["accept-language"]);
  const send = (status, code, errors, params) => {
    const body = { success: false, code, message: translate(code, lang, params) };
    if (errors) {
      body.errors = Object.fromEntries(Object.entries(errors).map(([field, key]) => [field, translate(key, lang)]));
    }
    return res.status(status).json(body);
  };

  if (err instanceof ErrorHandler) {
    return send(err.statusCode, err.code, err.errors, err.params);
  }

  if (err.type === "entity.parse.failed") {
    return send(400, "INVALID_JSON");
  }

  if (err.type === "entity.too.large") {
    return send(413, "PAYLOAD_TOO_LARGE");
  }

  console.error(err);
  return send(500, "INTERNAL_ERROR");
};

module.exports = errorHandler;
