const { Router } = require("express");
const requireAuth = require("../middlewares/requireAuth");
const companyController = require("../controllers/company.controller");

// /industry-types: the company profile's industry dropdown (any login).
const router = Router();

router.get("/", requireAuth, companyController.listIndustryTypes);

module.exports = router;
