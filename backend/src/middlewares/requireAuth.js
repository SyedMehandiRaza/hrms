const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/ErrorHandler");

// No token or a garbage token → AUTH_REQUIRED; an expired token → AUTH_TOKEN_EXPIRED
// (the UI refreshes once and retries on that code).
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ErrorHandler("AUTH_REQUIRED"));
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    return next();
  } catch (err) {
    return next(new ErrorHandler(err instanceof jwt.TokenExpiredError ? "AUTH_TOKEN_EXPIRED" : "AUTH_REQUIRED"));
  }
};

module.exports = requireAuth;
