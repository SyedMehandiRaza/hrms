const employeeDraftService = require("../services/employeeDraft.service");

const listDrafts = async (req, res) => {
  res.json({ success: true, data: await employeeDraftService.listDrafts(req.auth, req.query) });
};

const getDraft = async (req, res) => {
  res.json({ success: true, data: await employeeDraftService.getDraft(req.auth, req.params.id) });
};

const createDraft = async (req, res) => {
  res.status(201).json({ success: true, data: await employeeDraftService.createDraft(req.auth, req.body) });
};

const updateDraft = async (req, res) => {
  res.json({ success: true, data: await employeeDraftService.updateDraft(req.auth, req.params.id, req.body) });
};

const deleteDraft = async (req, res) => {
  res.json({ success: true, data: await employeeDraftService.deleteDraft(req.auth, req.params.id) });
};

module.exports = { listDrafts, getDraft, createDraft, updateDraft, deleteDraft };
