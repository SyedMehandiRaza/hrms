const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const { authRateLimiter, refreshRateLimiter } = require("../middlewares/rateLimit");
const { getRateLimitConfig } = require("../config/rateLimit");
const { loginSchema, signupSchema } = require("../validations/auth.validation");
const authController = require("../controllers/auth.controller");

// Built by a factory so tests can mount the real routes with small limits.
// Public routes get their own per-IP limiter (D11); new public routes (signup,
// forgot-password, verify-otp, reset-password, setup-password) use authRateLimiter(limits).
const createAuthRouter = (limits = getRateLimitConfig()) => {
  const router = Router();

  // Public / cookie-based (the refresh cookie is scoped to /api/auth).
  router.post("/login", authRateLimiter(limits), validate(loginSchema), authController.login);
  router.post("/signup", authRateLimiter(limits), validate(signupSchema), authController.signup);
  router.post("/refresh", refreshRateLimiter(limits), authController.refresh);
  router.post("/logout", authController.logout);

  // Any login.
  router.get("/me", requireAuth, authController.me);

  return router;
};

module.exports = { createAuthRouter };
