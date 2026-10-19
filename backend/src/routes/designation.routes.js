const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { designationSchema, listDesignationsSchema, designationOptionsSchema } = require("../validations/designation.validation");
const designationController = require("../controllers/designation.controller");

// Designations (D32): ADMIN, or a role with the matching designation flag.
// Staffing-company logins never (plan §2), whatever their role allows.
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("designation", action)];

// Mounted at /designations.
const router = Router();
router.get("/", ...can("read"), validate(designationOptionsSchema, "query"), designationController.listDesignationOptions);
router.put("/:id", ...can("update"), validate(designationSchema), designationController.updateDesignation);
router.delete("/:id", ...can("delete"), designationController.deleteDesignation);

// Mounted at /departments/:id/designations.
const departmentDesignationsRouter = Router({ mergeParams: true });
departmentDesignationsRouter.get(
  "/",
  ...can("read"),
  validate(listDesignationsSchema, "query"),
  designationController.listDesignations
);
departmentDesignationsRouter.post("/", ...can("create"), validate(designationSchema), designationController.createDesignation);

module.exports = { designationRouter: router, departmentDesignationsRouter };
