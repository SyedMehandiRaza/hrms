const exitService = require("../services/exit.service");

const raiseExit = async (req, res) => {
  const id = await exitService.raiseExit(req.auth, req.params.id, req.body);
  res.status(201).json({ success: true, data: await exitService.getExit(req.auth, id) });
};

const withdrawExit = async (req, res) => {
  const id = await exitService.withdrawExit(req.auth, req.params.id, req.body);
  res.json({ success: true, data: await exitService.getExit(req.auth, id) });
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

module.exports = { raiseExit, withdrawExit, listExits, getExit, getSettings, saveSettings };
