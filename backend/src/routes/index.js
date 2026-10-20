const { Router } = require("express");
const healthRoutes = require("./health.routes");
const { createAuthRouter } = require("./auth.routes");
const companyRoutes = require("./company.routes");
const industryTypeRoutes = require("./industryType.routes");
const departmentRoutes = require("./department.routes");
const { createGeoRouter } = require("./geo.routes");
const officeRoutes = require("./office.routes");
const projectRoutes = require("./project.routes");
const { router: shiftRoutes } = require("./shift.routes");
const { designationRouter, departmentDesignationsRouter } = require("./designation.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", createAuthRouter());
router.use("/company", companyRoutes);
router.use("/industry-types", industryTypeRoutes);
router.use("/countries", createGeoRouter());
router.use("/offices", officeRoutes);
router.use("/projects", projectRoutes);
router.use("/shifts", shiftRoutes);
router.use("/departments/:id/designations", departmentDesignationsRouter);
router.use("/departments", departmentRoutes);
router.use("/designations", designationRouter);

module.exports = router;
