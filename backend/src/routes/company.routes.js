const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const requireAccessLevel = require("../middlewares/requireAccessLevel");
const uploadLogo = require("../middlewares/uploadLogo");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { updateCompanySchema } = require("../validations/company.validation");
const companyController = require("../controllers/company.controller");

// /company (D27–D29): any login reads its own company; only the owner (ADMIN)
// edits it, whatever a role allows (SUB_ADMIN → 403).
const router = Router();
const ownerOnly = [requireAuth, requireAccessLevel(ACCESS_LEVELS.ADMIN)];

router.get("/", requireAuth, companyController.getCompany);
router.put("/", ...ownerOnly, validate(updateCompanySchema), companyController.updateCompany);
router.put("/logo", ...ownerOnly, uploadLogo, companyController.uploadLogo);
router.delete("/logo", ...ownerOnly, companyController.deleteLogo);

module.exports = router;
