const weekOffService = require("../services/weekOff.service");

const getWeekOffs = async (req, res) => {
  res.json({ success: true, data: await weekOffService.getWeekOffs(req.auth, req.params.id, req.query) });
};

const saveWeekOffs = async (req, res) => {
  res.json({ success: true, data: await weekOffService.saveWeekOffs(req.auth, req.params.id, req.body) });
};

const copyPreview = async (req, res) => {
  res.json({ success: true, data: await weekOffService.copyPreview(req.auth, req.query) });
};

const copyWeekOffs = async (req, res) => {
  res.json({ success: true, data: await weekOffService.copyWeekOffs(req.auth, req.body) });
};

const listYears = async (req, res) => {
  res.json({ success: true, data: await weekOffService.listYears(req.auth) });
};

module.exports = {
  listYears, getWeekOffs, saveWeekOffs, copyPreview, copyWeekOffs };
