const ErrorHandler = require("../utils/ErrorHandler");

// Single global error middleware. Never leaks raw errors or stack traces.
const errorHandler = (err, req, res, next) => {
  if (err instanceof ErrorHandler) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON body" });
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }
  return res.status(500).json({ success: false, message: "Internal server error" });
};

module.exports = errorHandler;
