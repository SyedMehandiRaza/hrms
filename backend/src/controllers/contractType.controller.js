const contractTypeService = require("../services/contractType.service");

const listTypes = async (req, res) => {
  res.json({ success: true, data: await contractTypeService.listTypes(req.auth, req.query) });
};

const getType = async (req, res) => {
  res.json({ success: true, data: await contractTypeService.getType(req.auth, req.params.id) });
};

const createType = async (req, res) => {
  res.status(201).json({ success: true, data: await contractTypeService.createType(req.auth, req.body) });
};

const updateType = async (req, res) => {
  res.json({ success: true, data: await contractTypeService.updateType(req.auth, req.params.id, req.body) });
};

const deleteType = async (req, res) => {
  res.json({ success: true, data: await contractTypeService.deleteType(req.auth, req.params.id) });
};

module.exports = { listTypes, getType, createType, updateType, deleteType };
