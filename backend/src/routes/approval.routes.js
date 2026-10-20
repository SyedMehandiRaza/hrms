const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { approveSchema, rejectSchema } = require("../validations/approval.validation");
const approvalController = require("../controllers/approval.controller");

// /approvals (workforce D23–D29): any company login; who may act is decided per request (the
// current level's approvers, the owner for owner-only and override). Staffing-company logins never.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];

router.get("/inbox", ...companyLogin, approvalController.inbox);
router.post("/:requestId/approve", ...companyLogin, validate(approveSchema), approvalController.approve);
router.post("/:requestId/reject", ...companyLogin, validate(rejectSchema), approvalController.reject);

module.exports = router;
