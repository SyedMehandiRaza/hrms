const { Router } = require("express");
const healthRoutes = require("./health.routes");
const { createAuthRouter } = require("./auth.routes");
const companyRoutes = require("./company.routes");
const industryTypeRoutes = require("./industryType.routes");
const departmentRoutes = require("./department.routes");
const { designationRouter, departmentDesignationsRouter } = require("./designation.routes");
const contractRecipientRoutes = require("./contractRecipient.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", createAuthRouter());
router.use("/company", companyRoutes);
router.use("/industry-types", industryTypeRoutes);
router.use("/departments/:id/designations", departmentDesignationsRouter);
router.use("/departments", departmentRoutes);
router.use("/designations", designationRouter);
router.use("/contract-recipients", contractRecipientRoutes);

module.exports = router;
