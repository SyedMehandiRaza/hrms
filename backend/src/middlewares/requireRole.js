const ErrorHandler = require("../utils/ErrorHandler");

// Restricts a route to the given access levels (see src/constants/accessLevels.js).
const requireRole =
  (...allowed) =>
  (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.accessLevel)) {
      return next(new ErrorHandler(403, "You do not have permission to perform this action"));
    }
    return next();
  };

module.exports = requireRole;
