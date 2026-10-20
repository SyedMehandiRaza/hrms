const contractService = require("../services/contract.service");

const createContracts = async (req, res) => {
  res.status(201).json({ success: true, data: await contractService.createContracts(req.auth, req.body) });
};

const editDraft = async (req, res) => {
  res.json({ success: true, data: await contractService.editDraft(req.auth, req.params.id, req.body) });
};

const deleteDraft = async (req, res) => {
  res.json({ success: true, data: await contractService.deleteDraft(req.auth, req.params.id) });
};

module.exports = { createContracts, editDraft, deleteDraft };
