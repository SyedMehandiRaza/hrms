const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/ErrorHandler");
const { getAuthConfig } = require("../config/auth");
const { resolveAccessToken } = require("../services/auth.service");

// Bearer access token → req.auth = { userId, accountId, employerId, sessionId,
// accessLevel, roleId, permissions }.
// No token or a garbage token → AUTH_REQUIRED; an expired token → AUTH_TOKEN_EXPIRED
// (the UI refreshes once and retries on that code). Every request re-checks the session
// (revoked → AUTH_REQUIRED), the account and person (→ 403 AUTH_ACCOUNT_INACTIVE) and the
// company (→ 403 AUTH_COMPANY_INACTIVE), and loads the role's permissions fresh.
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ErrorHandler("AUTH_REQUIRED"));
  }

  let claims;
  try {
    claims = jwt.verify(token, getAuthConfig().accessSecret);
  } catch (err) {
    return next(new ErrorHandler(err instanceof jwt.TokenExpiredError ? "AUTH_TOKEN_EXPIRED" : "AUTH_REQUIRED"));
  }

  try {
    req.auth = await resolveAccessToken(claims);
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = requireAuth;
