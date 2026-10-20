const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const {
  createGroupSchema,
  updateGroupSchema,
  membersSchema,
  statusSchema,
  listGroupsSchema,
  approverOptionsSchema,
} = require("../validations/approvalGroup.validation");
const groupController = require("../controllers/approvalGroup.controller");

// /approval-groups (workforce D17–D22, ADR 0011): ADMIN, or a role with the matching
// approval_group flag. Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("approval_group", action)];

router.get("/", ...can("read"), validate(listGroupsSchema, "query"), groupController.listGroups);
router.get("/approver-options", ...can("read"), validate(approverOptionsSchema, "query"), groupController.approverOptions);
router.post("/", ...can("create"), validate(createGroupSchema), groupController.createGroup);
router.get("/:id", ...can("read"), groupController.getGroup);
router.put("/:id", ...can("update"), validate(updateGroupSchema), groupController.updateGroup);
router.put("/:id/members", ...can("update"), validate(membersSchema), groupController.updateMembers);
router.patch("/:id/status", ...can("update"), validate(statusSchema), groupController.changeStatus);

module.exports = router;
