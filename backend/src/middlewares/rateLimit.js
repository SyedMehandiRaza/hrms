const { rateLimit } = require("express-rate-limit");
const ErrorHandler = require("../utils/ErrorHandler");
const { getRateLimitConfig } = require("../config/rateLimit");

// In-memory, per-IP limiter (D11). Each call has its own counter, so every route
// that uses one gets its own budget. Over the limit → 429 RATE_LIMITED.
const createRateLimiter = ({ limit, windowMs }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res, next) => next(new ErrorHandler("RATE_LIMITED")),
  });

// 10/min: login, signup, forgot-password, verify-otp, reset-password, setup-password.
const authRateLimiter = (limits = getRateLimitConfig()) =>
  createRateLimiter({ limit: limits.authMax, windowMs: limits.windowMs });

// 60/min: refresh.
const refreshRateLimiter = (limits = getRateLimitConfig()) =>
  createRateLimiter({ limit: limits.refreshMax, windowMs: limits.windowMs });

module.exports = { createRateLimiter, authRateLimiter, refreshRateLimiter };
