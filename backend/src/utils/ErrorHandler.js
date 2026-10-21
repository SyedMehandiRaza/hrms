const { MESSAGES } = require("../constants/messages");

// Known API error. `code` is a key of constants/messages.js; the status comes
// from the catalog and the message is translated by the error middleware.
//   next(new ErrorHandler("DEPARTMENT_NAME_TAKEN"))
//   next(new ErrorHandler("VALIDATION_FAILED", { errors: { deptHeadId: "departmentHeadInvalid" } }))
// `errors` maps field → field message key (or code), translated per request.
// `params` fill the message's placeholders:
//   new ErrorHandler("REHIRE_NOT_ALLOWED", { params: { date: "2026-11-15" } })
class ErrorHandler extends Error {
  constructor(code, { errors, params } = {}) {
    const entry = MESSAGES[code];
    if (!entry) {
      throw new Error(`Unknown error code: ${code}`);
    }
    super(entry.en);
    this.code = code;
    this.statusCode = entry.status;
    if (errors) this.errors = errors;
    if (params) this.params = params;
  }
}

module.exports = ErrorHandler;
