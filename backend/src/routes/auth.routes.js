const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const { loginSchema } = require("../validations/auth.validation");
const authController = require("../controllers/auth.controller");

const router = Router();

// Public / cookie-based (the refresh cookie is scoped to /api/auth).
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

// Any login.
router.get("/me", requireAuth, authController.me);

module.exports = router;
