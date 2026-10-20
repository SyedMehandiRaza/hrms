const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { shiftSchema, listShiftsSchema } = require("../validations/shift.validation");
const shiftController = require("../controllers/shift.controller");

// /shifts (workforce D35–D39): ADMIN, or a role with the matching shift flag.
// Staffing-company logins never (workforce D57), whatever their role allows.
const router = Router();
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("shift", action)];

router.get("/", ...can("read"), validate(listShiftsSchema, "query"), shiftController.listShifts);
router.post("/", ...can("create"), validate(shiftSchema), shiftController.createShift);
router.get("/:id", ...can("read"), shiftController.getShift);
router.put("/:id", ...can("update"), validate(shiftSchema), shiftController.updateShift);
router.delete("/:id", ...can("delete"), shiftController.deleteShift);

module.exports = { router, can };
