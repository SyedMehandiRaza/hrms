const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { listExitsSchema, exitSettingsSchema, withdrawExitSchema, editTermsSchema, confirmImmediateSchema } =require("../validations/exit.validation");
const exitController = require("../controllers/exit.controller");

// /exits and /exit-settings (workforce D58–D66): ADMIN, or a role with the matching exit flag.
// Staffing-company logins never (workforce D57), whatever their role allows. Raising an exit is
// POST /employees/:id/exits (employee.routes.js).
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
const can = (action) => [...companyLogin, requirePermission("exit", action)];

const exitRouter = Router();
exitRouter.get("/", ...can("read"), validate(listExitsSchema, "query"), exitController.listExits);
exitRouter.get("/:id", ...can("read"), exitController.getExit);
// Withdraw a pending exit (D59): its raiser, the owner, or employee:create + update — checked by the service.
exitRouter.post("/:id/withdraw", ...companyLogin, validate(withdrawExitSchema), exitController.withdrawExit);
// In notice (D65): edit terms and cancel need employee:create + update — checked by the service.
exitRouter.put("/:id/terms", ...companyLogin, validate(editTermsSchema), exitController.editTerms);
exitRouter.post("/:id/cancel", ...companyLogin, validate(withdrawExitSchema), exitController.cancelExit);
// Confirm → Immediate (D64): the owner only.
exitRouter.post("/:id/confirm-immediate", requireAuth, requireAccessLevel(ACCESS_LEVELS.ADMIN), validate(confirmImmediateSchema), exitController.confirmImmediate);

const exitSettingsRouter = Router();
exitSettingsRouter.get("/", ...can("read"), exitController.getSettings);
exitSettingsRouter.put("/", ...can("update"), validate(exitSettingsSchema), exitController.saveSettings);

module.exports = { exitRouter, exitSettingsRouter };
