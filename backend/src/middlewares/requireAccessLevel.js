const ErrorHandler = require("../utils/ErrorHandler");

// Use after requireAuth to restrict a route to access levels regardless of role,
// e.g. owner-only endpoints: requireAccessLevel("ADMIN") (see src/constants/accessLevels.js).
const requireAccessLevel =
  (...allowed) =>
  (req, res, next) => {
    if (!req.auth || !allowed.includes(req.auth.accessLevel)) {
      return next(new ErrorHandler("FORBIDDEN"));
    }
    return next();
  };

module.exports = requireAccessLevel;
