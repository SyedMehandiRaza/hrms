const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { salaryComponentSchema, listSalaryComponentsSchema } = require("../validations/salaryComponent.validation");
const componentController = require("../controllers/salaryComponent.controller");

// /salary-components (workforce D41–D43): ADMIN, or a role with the matching salary flag.
// Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("salary", action)];

router.get("/", ...can("read"), validate(listSalaryComponentsSchema, "query"), componentController.listComponents);
router.post("/", ...can("create"), validate(salaryComponentSchema), componentController.createComponent);
router.get("/:id", ...can("read"), componentController.getComponent);
router.put("/:id", ...can("update"), validate(salaryComponentSchema), componentController.updateComponent);
// "Delete" = deactivate (D43).
router.delete("/:id", ...can("delete"), componentController.deactivateComponent);

module.exports = router;
