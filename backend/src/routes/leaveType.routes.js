const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { leaveTypeSchema, listLeaveTypesSchema } = require("../validations/leaveType.validation");
const leaveTypeController = require("../controllers/leaveType.controller");

// /leave-types (workforce D30–D32): ADMIN, or a role with the matching leave_type flag.
// Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("leave_type", action)];

router.get("/", ...can("read"), validate(listLeaveTypesSchema, "query"), leaveTypeController.listLeaveTypes);
router.post("/", ...can("create"), validate(leaveTypeSchema), leaveTypeController.createLeaveType);
router.get("/:id", ...can("read"), leaveTypeController.getLeaveType);
router.put("/:id", ...can("update"), validate(leaveTypeSchema), leaveTypeController.updateLeaveType);
router.delete("/:id", ...can("delete"), leaveTypeController.deleteLeaveType);
// "Save as new version" stays in the UI but isn't available yet (D30).
router.post("/:id/versions", ...can("update"), leaveTypeController.createVersion);

module.exports = router;
