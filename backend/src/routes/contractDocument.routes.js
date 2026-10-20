const { Router } = require("express");
const validate = require("../middlewares/validate");
const { uploadContractDocuments } = require("../middlewares/uploadContractDocuments");
const { can } = require("./contractAccess");
const { listDocumentsSchema, documentUpdateSchema } = require("../validations/contract.validation");
const contractDocumentController = require("../controllers/contractDocument.controller");

// /contract-documents (plan decisions 6–8): contract:read/create/update/delete.
const router = Router();

router.get("/", ...can("read"), validate(listDocumentsSchema, "query"), contractDocumentController.listDocuments);
router.post("/", ...can("create"), uploadContractDocuments, contractDocumentController.uploadDocuments);
router.patch("/:id", ...can("update"), validate(documentUpdateSchema), contractDocumentController.updateDocument);
router.delete("/:id", ...can("delete"), contractDocumentController.deleteDocument);
router.get("/:id/file", ...can("read"), contractDocumentController.documentFile);

module.exports = router;
