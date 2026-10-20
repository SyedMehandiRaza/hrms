const groupService = require("../services/approvalGroup.service");

const listGroups = async (req, res) => {
  res.json({ success: true, data: await groupService.listGroups(req.auth, req.query) });
};

const approverOptions = async (req, res) => {
  res.json({ success: true, data: await groupService.approverOptions(req.auth, req.query) });
};

const getGroup = async (req, res) => {
  res.json({ success: true, data: await groupService.getGroup(req.auth, req.params.id) });
};

const createGroup = async (req, res) => {
  res.status(201).json({ success: true, data: await groupService.createGroup(req.auth, req.body) });
};

const updateGroup = async (req, res) => {
  res.json({ success: true, data: await groupService.updateGroup(req.auth, req.params.id, req.body) });
};

const updateMembers = async (req, res) => {
  res.json({ success: true, data: await groupService.updateMembers(req.auth, req.params.id, req.body) });
};

const changeStatus = async (req, res) => {
  res.json({ success: true, data: await groupService.changeStatus(req.auth, req.params.id, req.body) });
};

module.exports = { listGroups, approverOptions, getGroup, createGroup, updateGroup, updateMembers, changeStatus };
