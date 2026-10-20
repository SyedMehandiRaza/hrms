const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { listStaffingCompaniesSchema } = require("../validations/lookup.validation");
const lookupController = require("../controllers/lookup.controller");

// /roles and /staffing-companies lookups (workforce D48): ADMIN, or a role with employee:create
// or employee:update. Staffing-company logins never (workforce D57), whatever their role allows.
const employeeEditor = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
  requirePermission("employee", ["create", "update"]),
];

const roleRouter = Router();
roleRouter.get("/", ...employeeEditor, lookupController.listRoles);

const staffingCompanyRouter = Router();
staffingCompanyRouter.get("/", ...employeeEditor, validate(listStaffingCompaniesSchema, "query"), lookupController.listStaffingCompanies);

module.exports = { roleRouter, staffingCompanyRouter };
