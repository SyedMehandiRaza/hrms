const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { draftSchema, listDraftsSchema } = require("../validations/employeeDraft.validation");
const employeeDraftController = require("../controllers/employeeDraft.controller");

// /employee-drafts (workforce D53): ADMIN, or a role with employee:create — for every action.
// Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const creator = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
  requirePermission("employee", "create"),
];

router.get("/", ...creator, validate(listDraftsSchema, "query"), employeeDraftController.listDrafts);
router.post("/", ...creator, validate(draftSchema), employeeDraftController.createDraft);
router.get("/:id", ...creator, employeeDraftController.getDraft);
router.put("/:id", ...creator, validate(draftSchema), employeeDraftController.updateDraft);
router.delete("/:id", ...creator, employeeDraftController.deleteDraft);

module.exports = router;
