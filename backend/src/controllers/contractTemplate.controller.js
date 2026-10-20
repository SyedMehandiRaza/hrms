const contractTemplateService = require("../services/contractTemplate.service");

const listTemplates = async (req, res) => {
  res.json({ success: true, data: await contractTemplateService.listTemplates(req.auth, req.query) });
};

const getTemplate = async (req, res) => {
  res.json({ success: true, data: await contractTemplateService.getTemplate(req.auth, req.params.id) });
};

const createTemplate = async (req, res) => {
  res.status(201).json({ success: true, data: await contractTemplateService.createTemplate(req.auth, req.body) });
};

const updateTemplate = async (req, res) => {
  res.json({ success: true, data: await contractTemplateService.updateTemplate(req.auth, req.params.id, req.body) });
};

const duplicateTemplate = async (req, res) => {
  res.status(201).json({ success: true, data: await contractTemplateService.duplicateTemplate(req.auth, req.params.id) });
};

const setTemplateStatus = async (req, res) => {
  res.json({ success: true, data: await contractTemplateService.setTemplateStatus(req.auth, req.params.id, req.body) });
};

const deleteTemplate = async (req, res) => {
  res.json({ success: true, data: await contractTemplateService.deleteTemplate(req.auth, req.params.id) });
};

const mergeFields = async (req, res) => {
  res.json({ success: true, data: contractTemplateService.mergeFieldCatalogue(req.query.audience) });
};

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  setTemplateStatus,
  deleteTemplate,
  mergeFields,
};
