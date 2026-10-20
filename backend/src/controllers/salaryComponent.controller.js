const componentService = require("../services/salaryComponent.service");

const listComponents = async (req, res) => {
  res.json({ success: true, data: await componentService.listComponents(req.auth, req.query) });
};

const getComponent = async (req, res) => {
  res.json({ success: true, data: await componentService.getComponent(req.auth, req.params.id) });
};

const createComponent = async (req, res) => {
  res.status(201).json({ success: true, data: await componentService.createComponent(req.auth, req.body) });
};

const updateComponent = async (req, res) => {
  res.json({ success: true, data: await componentService.updateComponent(req.auth, req.params.id, req.body) });
};

const deactivateComponent = async (req, res) => {
  res.json({ success: true, data: await componentService.deactivateComponent(req.auth, req.params.id) });
};

module.exports = { listComponents, getComponent, createComponent, updateComponent, deactivateComponent };
