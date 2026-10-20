const shiftService = require("../services/shift.service");

const listShifts = async (req, res) => {
  res.json({ success: true, data: await shiftService.listShifts(req.auth, req.query) });
};

const getShift = async (req, res) => {
  res.json({ success: true, data: await shiftService.getShift(req.auth, req.params.id) });
};

const createShift = async (req, res) => {
  res.status(201).json({ success: true, data: await shiftService.createShift(req.auth, req.body) });
};

const updateShift = async (req, res) => {
  res.json({ success: true, data: await shiftService.updateShift(req.auth, req.params.id, req.body) });
};

const deleteShift = async (req, res) => {
  res.json({ success: true, data: await shiftService.deleteShift(req.auth, req.params.id) });
};

module.exports = { listShifts, getShift, createShift, updateShift, deleteShift };
