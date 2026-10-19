const ErrorHandler = require("../utils/ErrorHandler");

// Restricts a route to the given access levels (see src/constants/accessLevels.js).
const requireRole =
  (...allowed) =>
  (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.accessLevel)) {
      return next(new ErrorHandler("FORBIDDEN"));
    }
    return next();
  };

module.exports = requireRole;
