const designationService = require("../services/designation.service");

const listDesignations = async (req, res) => {
  res.json({ success: true, data: await designationService.listDesignations(req.auth, req.params.id, req.query) });
};

const listDesignationOptions = async (req, res) => {
  res.json({ success: true, data: await designationService.listDesignationOptions(req.auth, req.query) });
};

const createDesignation = async (req, res) => {
  res.status(201).json({ success: true, data: await designationService.createDesignation(req.auth, req.params.id, req.body) });
};

const updateDesignation = async (req, res) => {
  res.json({ success: true, data: await designationService.updateDesignation(req.auth, req.params.id, req.body) });
};

const deleteDesignation = async (req, res) => {
  res.json({ success: true, data: await designationService.deleteDesignation(req.auth, req.params.id) });
};

module.exports = { listDesignations, listDesignationOptions, createDesignation, updateDesignation, deleteDesignation };
