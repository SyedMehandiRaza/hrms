const exitService = require("../services/exit.service");
const rehireService = require("../services/rehire.service");

const raiseExit = async (req, res) => {
  const id = await exitService.raiseExit(req.auth, req.params.id, req.body);
  res.status(201).json({ success: true, data: await exitService.getExit(req.auth, id) });
};

const exitPreview = async (req, res) => {
  res.json({ success: true, data: await exitService.exitPreview(req.auth, req.params.id) });
};

const withdrawExit = async (req, res) => {
  const id = await exitService.withdrawExit(req.auth, req.params.id, req.body);
  res.json({ success: true, data: await exitService.getExit(req.auth, id) });
};

const editTerms = async (req, res) => {
  const id = await exitService.editTerms(req.auth, req.params.id, req.body);
  res.json({ success: true, data: await exitService.getExit(req.auth, id) });
};

const cancelExit = async (req, res) => {
  const id = await exitService.cancelExit(req.auth, req.params.id, req.body);
  res.json({ success: true, data: await exitService.getExit(req.auth, id) });
};

const confirmImmediate = async (req, res) => {
  const id = await exitService.confirmImmediate(req.auth, req.params.id, req.body);
  res.json({ success: true, data: await exitService.getExit(req.auth, id) });
};

const rehire = async (req, res) => {
  res.json({ success: true, data: await rehireService.rehire(req.auth, req.params.id, req.body) });
};

const listExits = async (req, res) => {
  res.json({ success: true, data: await exitService.listExits(req.auth, req.query) });
};

const getExit = async (req, res) => {
  res.json({ success: true, data: await exitService.getExit(req.auth, req.params.id) });
};

const getSettings = async (req, res) => {
  res.json({ success: true, data: await exitService.getSettings(req.auth) });
};

const saveSettings = async (req, res) => {
  res.json({ success: true, data: await exitService.saveSettings(req.auth, req.body) });
};

module.exports = { exitPreview, raiseExit, withdrawExit, editTerms, cancelExit, confirmImmediate, rehire, listExits, getExit, getSettings, saveSettings };
