const { Router } = require("express");
const validate = require("../middlewares/validate");
const { can } = require("./contractAccess");
const { createContractsSchema, editDraftSchema } = require("../validations/contract.validation");
const contractController = require("../controllers/contract.controller");

// /contracts (HR side, plan endpoints): contract:create/update/delete.
const router = Router();

router.post("/", ...can("create"), validate(createContractsSchema), contractController.createContracts);
router.put("/:id", ...can("update"), validate(editDraftSchema), contractController.editDraft);
router.delete("/:id", ...can("delete"), contractController.deleteDraft);

module.exports = router;
