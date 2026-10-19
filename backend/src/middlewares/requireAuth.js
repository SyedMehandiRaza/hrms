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
// While the account still has a temporary password (password_setup_required), every
// route except the allow-list below → 403 AUTH_PASSWORD_CHANGE_REQUIRED (ADR 0003).
// Living here, the gate covers every current and future router that uses requireAuth.

// "METHOD full-path" (mount prefix included). Logout needs no token but is listed so it
// keeps working if it ever does.
const PASSWORD_CHANGE_ALLOWED = new Set([
  "GET /api/auth/me",
  "POST /api/auth/change-password",
  "POST /api/auth/logout",
]);

const allowedDuringPasswordChange = (req) => {
  const path = `${req.baseUrl}${req.path}`.replace(/\/+$/, "");
  return PASSWORD_CHANGE_ALLOWED.has(`${req.method} ${path}`);
};

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
  } catch (err) {
    return next(err);
  }

  if (req.auth.mustChangePassword && !allowedDuringPasswordChange(req)) {
    return next(new ErrorHandler("AUTH_PASSWORD_CHANGE_REQUIRED"));
  }
  return next();
};

module.exports = requireAuth;
