const leaveTypeService = require("../services/leaveType.service");

const listLeaveTypes = async (req, res) => {
  res.json({ success: true, data: await leaveTypeService.listLeaveTypes(req.auth, req.query) });
};

const getLeaveType = async (req, res) => {
  res.json({ success: true, data: await leaveTypeService.getLeaveType(req.auth, req.params.id) });
};

const createLeaveType = async (req, res) => {
  res.status(201).json({ success: true, data: await leaveTypeService.createLeaveType(req.auth, req.body) });
};

const updateLeaveType = async (req, res) => {
  res.json({ success: true, data: await leaveTypeService.updateLeaveType(req.auth, req.params.id, req.body) });
};

const deleteLeaveType = async (req, res) => {
  res.json({ success: true, data: await leaveTypeService.deleteLeaveType(req.auth, req.params.id) });
};

const createVersion = async (req, res) => {
  res.json({ success: true, data: await leaveTypeService.createVersion(req.auth, req.params.id) });
};

module.exports = { listLeaveTypes, getLeaveType, createLeaveType, updateLeaveType, deleteLeaveType, createVersion };
