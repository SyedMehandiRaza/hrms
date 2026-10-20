const { MESSAGES } = require("../constants/messages");
const { fill } = require("./i18n");

// Known API error. `code` is a key of constants/messages.js; the status comes
// from the catalog and the message is translated by the error middleware.
//   next(new ErrorHandler("DEPARTMENT_NAME_TAKEN"))
//   next(new ErrorHandler("VALIDATION_FAILED", { errors: { deptHeadId: "departmentHeadInvalid" } }))
//   next(new ErrorHandler("CONTRACT_ACTIVE_EXISTS", { params: { number: "CON-2026-0007" } }))
// `errors` maps field → field message key (or code), translated per request.
// `params` fills the message's {{placeholders}} in every language.
class ErrorHandler extends Error {
  constructor(code, { errors, params } = {}) {
    const entry = MESSAGES[code];
    if (!entry) {
      throw new Error(`Unknown error code: ${code}`);
    }
    super(fill(entry.en, params));
    this.code = code;
    this.statusCode = entry.status;
    if (errors) this.errors = errors;
    if (params) this.params = params;
  }
}

module.exports = ErrorHandler;
