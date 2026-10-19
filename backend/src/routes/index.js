const { Router } = require("express");
const healthRoutes = require("./health.routes");
const { createAuthRouter } = require("./auth.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", createAuthRouter());

module.exports = router;
