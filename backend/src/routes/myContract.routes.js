const { Router } = require("express");
const validate = require("../middlewares/validate");
const requireAuth = require("../middlewares/requireAuth");
const { myContractsListSchema } = require("../validations/contract.validation");
const contractSignerController = require("../controllers/contractSigner.controller");

// /my/contracts: the signer, from any panel. No permission flag; the service only shows
// contracts addressed to the caller (plan decision 26).
const router = Router();

router.get("/", requireAuth, validate(myContractsListSchema, "query"), contractSignerController.listMine);
router.get("/:id", requireAuth, contractSignerController.getMine);
router.get("/:id/document", requireAuth, contractSignerController.myDocument);
router.get("/:id/pdf", requireAuth, contractSignerController.myPdf);

module.exports = router;
