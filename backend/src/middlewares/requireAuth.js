const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/ErrorHandler");

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ErrorHandler(401, "Authentication required"));
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    return next();
  } catch {
    return next(new ErrorHandler(401, "Invalid or expired token"));
  }
};

module.exports = requireAuth;
