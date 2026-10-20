const { Router } = require("express");
const validate = require("../middlewares/validate");
const { can } = require("./contractAccess");
const { templateSchema, templateStatusSchema, listTemplatesSchema, mergeFieldsQuerySchema } = require("../validations/contract.validation");
const contractTemplateController = require("../controllers/contractTemplate.controller");

// /contract-templates and /contract-merge-fields (plan decisions 9–14, 44): contract:*.
const templateRouter = Router();

templateRouter.get("/", ...can("read"), validate(listTemplatesSchema, "query"), contractTemplateController.listTemplates);
templateRouter.post("/", ...can("create"), validate(templateSchema), contractTemplateController.createTemplate);
templateRouter.get("/:id", ...can("read"), contractTemplateController.getTemplate);
templateRouter.put("/:id", ...can("update"), validate(templateSchema), contractTemplateController.updateTemplate);
templateRouter.delete("/:id", ...can("delete"), contractTemplateController.deleteTemplate);
templateRouter.post("/:id/duplicate", ...can("create"), contractTemplateController.duplicateTemplate);
templateRouter.patch("/:id/status", ...can("update"), validate(templateStatusSchema), contractTemplateController.setTemplateStatus);

const mergeFieldRouter = Router();
mergeFieldRouter.get("/", ...can("read"), validate(mergeFieldsQuerySchema, "query"), contractTemplateController.mergeFields);

module.exports = { templateRouter, mergeFieldRouter };
