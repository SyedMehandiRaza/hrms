const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { createEmployeeSchema, checkUniqueSchema } = require("../validations/employee.validation");
const employeeController = require("../controllers/employee.controller");

// /employees (workforce D44–D53): ADMIN, or a role with the matching employee flag.
// Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("employee", action)];

// The wizard's step 1 (create) and the Edit modal (update) both check duplicates.
router.get("/check-unique", ...can(["create", "update"]), validate(checkUniqueSchema, "query"), employeeController.checkUnique);
router.post("/", ...can("create"), validate(createEmployeeSchema), employeeController.createEmployee);

module.exports = router;
