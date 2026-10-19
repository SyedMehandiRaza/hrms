const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const requirePermission = require("../middlewares/requirePermission");
const uploadLogo = require("../middlewares/uploadLogo");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { updateCompanySchema, updateTimeSettingsSchema } = require("../validations/company.validation");
const companyController = require("../controllers/company.controller");

// /company (D27–D29): any login reads its own company; only the owner (ADMIN)
// edits it, whatever a role allows (SUB_ADMIN → 403).
const router = Router();
const ownerOnly = [requireAuth, requireAccessLevel(ACCESS_LEVELS.ADMIN)];

router.get("/", requireAuth, companyController.getCompany);
router.put("/", ...ownerOnly, validate(updateCompanySchema), companyController.updateCompany);
router.put("/logo", ...ownerOnly, uploadLogo, companyController.uploadLogo);
router.delete("/logo", ...ownerOnly, companyController.deleteLogo);

// /company/time-settings (D30): ADMIN or a role with financial_year read/update.
// Staffing-company logins never (plan §2), whatever their role allows.
const companyLogin = [
  requireAuth,
  requireAccessLevel(ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN, ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE),
];
router.get("/time-settings", ...companyLogin, requirePermission("financial_year", "read"), companyController.getTimeSettings);
router.patch(
  "/time-settings",
  ...companyLogin,
  requirePermission("financial_year", "update"),
  validate(updateTimeSettingsSchema, "body", { singleFieldCode: true }),
  companyController.updateTimeSettings
);

module.exports = router;
