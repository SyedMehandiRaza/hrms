const ErrorHandler = require("../utils/ErrorHandler");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { ACTIONS } = require("../services/permission.service");

// Use after requireAuth: requirePermission("department", "create").
// The owner (ADMIN) always passes; everyone else needs the flag on their role
// (no role → every flag false) or gets 403 FORBIDDEN.
const requirePermission = (moduleKey, action) => {
  if (!ACTIONS.includes(action)) throw new Error(`requirePermission: unknown action "${action}"`);

  return (req, res, next) => {
    const auth = req.auth;
    if (auth && (auth.accessLevel === ACCESS_LEVELS.ADMIN || auth.permissions?.[moduleKey]?.[action] === true)) {
      return next();
    }
    return next(new ErrorHandler("FORBIDDEN"));
  };
};

module.exports = requirePermission;
