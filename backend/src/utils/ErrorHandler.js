const { MESSAGES } = require("../constants/messages");

// Known API error. `code` is a key of constants/messages.js; the status comes
// from the catalog and the message is translated by the error middleware.
//   next(new ErrorHandler("DEPARTMENT_NAME_TAKEN"))
//   next(new ErrorHandler("VALIDATION_FAILED", { errors: { deptHeadId: "departmentHeadInvalid" } }))
// `errors` maps field → field message key (or code), translated per request.
class ErrorHandler extends Error {
  constructor(code, { errors } = {}) {
    const entry = MESSAGES[code];
    if (!entry) {
      throw new Error(`Unknown error code: ${code}`);
    }
    super(entry.en);
    this.code = code;
    this.statusCode = entry.status;
    if (errors) this.errors = errors;
  }
}

module.exports = ErrorHandler;
