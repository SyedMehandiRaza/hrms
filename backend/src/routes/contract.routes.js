const { Router } = require("express");
const validate = require("../middlewares/validate");
const { can } = require("./contractAccess");
const { createContractsSchema, editDraftSchema, listContractsSchema } = require("../validations/contract.validation");
const contractController = require("../controllers/contract.controller");

// /contracts (HR side, plan endpoints): contract:read/create/update/delete.
const router = Router();

router.get("/", ...can("read"), validate(listContractsSchema, "query"), contractController.listContracts);
router.get("/stats", ...can("read"), contractController.contractStats);
router.post("/", ...can("create"), validate(createContractsSchema), contractController.createContracts);
router.get("/:id", ...can("read"), contractController.getContract);
router.get("/:id/pdf", ...can("read"), contractController.contractPdf);
router.put("/:id", ...can("update"), validate(editDraftSchema), contractController.editDraft);
router.delete("/:id", ...can("delete"), contractController.deleteDraft);
router.post("/:id/send", ...can("create"), contractController.sendDraft);

module.exports = router;
