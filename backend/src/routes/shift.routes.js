const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { shiftSchema, listShiftsSchema } = require("../validations/shift.validation");
const shiftController = require("../controllers/shift.controller");
const weekOffController = require("../controllers/weekOff.controller");
const { saveWeekOffsSchema, getWeekOffsSchema, copyPreviewSchema, copySchema } = require("../validations/weekOff.validation");

// /shifts (workforce D35–D39): ADMIN, or a role with the matching shift flag.
// Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("shift", action)];

router.get("/", ...can("read"), validate(listShiftsSchema, "query"), shiftController.listShifts);
// The years the week-off calendar can show; before /:id.
router.get("/week-offs/years", ...can("read"), weekOffController.listYears);
// Copy week-offs to the next year (D39); before /:id.
router.get("/week-offs/copy-preview", ...can("update"), validate(copyPreviewSchema, "query"), weekOffController.copyPreview);
router.post("/week-offs/copy", ...can("update"), validate(copySchema), weekOffController.copyWeekOffs);
router.post("/", ...can("create"), validate(shiftSchema), shiftController.createShift);
router.get("/:id", ...can("read"), shiftController.getShift);
router.put("/:id", ...can("update"), validate(shiftSchema), shiftController.updateShift);
router.delete("/:id", ...can("delete"), shiftController.deleteShift);
// A shift's off days for one financial year (D38).
router.get("/:id/week-offs", ...can("read"), validate(getWeekOffsSchema, "query"), weekOffController.getWeekOffs);
router.put("/:id/week-offs", ...can("update"), validate(saveWeekOffsSchema), weekOffController.saveWeekOffs);

module.exports = { router };
