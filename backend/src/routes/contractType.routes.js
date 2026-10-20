const { Router } = require("express");
const validate = require("../middlewares/validate");
const { can } = require("./contractAccess");
const { contractTypeSchema, listContractTypesSchema } = require("../validations/contract.validation");
const contractTypeController = require("../controllers/contractType.controller");

// /contract-types (plan decisions 15–17): contract:read/create/update/delete.
const router = Router();

router.get("/", ...can("read"), validate(listContractTypesSchema, "query"), contractTypeController.listTypes);
router.post("/", ...can("create"), validate(contractTypeSchema), contractTypeController.createType);
router.get("/:id", ...can("read"), contractTypeController.getType);
router.put("/:id", ...can("update"), validate(contractTypeSchema), contractTypeController.updateType);
router.delete("/:id", ...can("delete"), contractTypeController.deleteType);

module.exports = router;
