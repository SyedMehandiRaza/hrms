const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { createEmployeeSchema, editEmployeeSchema, mainProjectSchema, checkUniqueSchema, listEmployeesSchema, bulkStatusSchema } = require("../validations/employee.validation");
const employeeController = require("../controllers/employee.controller");
const exitController = require("../controllers/exit.controller");
const { raiseExitSchema } = require("../validations/exit.validation");

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
// The list is for the Admin panel only; Employee-panel logins see just their own profile (D57).
router.get(
  "/",
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN),
  requirePermission("employee", "read"),
  validate(listEmployeesSchema, "query"),
  employeeController.listEmployees
);
router.post("/bulk-status", ...can("update"), validate(bulkStatusSchema), employeeController.bulkStatus);
// Detail: employee:read, or an Employee-panel login reading itself (checked by the service).
router.get("/:id", ...companyLogin, employeeController.getEmployee);
router.put("/:id", ...can("update"), validate(editEmployeeSchema), employeeController.updateEmployee);
router.put("/:id/main-project", ...can("update"), validate(mainProjectSchema), employeeController.changeMainProject);
// Raise an exit (D66): own resignation for any company login with an employee record (":id" may be
// "me"); for someone else employee:create + employee:update. Checked by the service.
router.post("/:id/exits", ...companyLogin, validate(raiseExitSchema), exitController.raiseExit);
// The raise-exit wizard's defaults and handover warnings (D62, D65); same access as raising.
router.get("/:id/exit-preview", ...companyLogin, exitController.exitPreview);
router.post("/:id/resend-login", ...can("update"), employeeController.resendLogin);

module.exports = router;
