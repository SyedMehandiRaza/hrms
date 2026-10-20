const ErrorHandler = require("../utils/ErrorHandler");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { ACTIONS } = require("../services/permission.service");

// Use after requireAuth: requirePermission("department", "create"), or with a list of actions
// where any one is enough: requirePermission("employee", ["create", "update"]).
// The owner (ADMIN) always passes; everyone else needs the flag on their role
// (no role → every flag false) or gets 403 FORBIDDEN.
const requirePermission = (moduleKey, action) => {
  const actions = [].concat(action);
  for (const a of actions) {
    if (!ACTIONS.includes(a)) throw new Error(`requirePermission: unknown action "${a}"`);
  }

  return (req, res, next) => {
    const auth = req.auth;
    if (auth && (auth.accessLevel === ACCESS_LEVELS.ADMIN || actions.some((a) => auth.permissions?.[moduleKey]?.[a] === true))) {
      return next();
    }
    return next(new ErrorHandler("FORBIDDEN"));
  };
};

module.exports = requirePermission;
