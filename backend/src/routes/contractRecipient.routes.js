const { Router } = require("express");
const validate = require("../middlewares/validate");
const { can } = require("./contractAccess");
const { recipientLookupSchema } = require("../validations/contract.validation");
const contractRecipientController = require("../controllers/contractRecipient.controller");

// /contract-recipients: send-wizard picker, contract:create (plan endpoints).
const router = Router();

router.get("/", ...can("create"), validate(recipientLookupSchema, "query"), contractRecipientController.lookupRecipients);

module.exports = router;
