const departmentService = require("../services/department.service");

const listDepartments = async (req, res) => {
  res.json({ success: true, data: await departmentService.listDepartments(req.auth, req.query) });
};

const getDepartment = async (req, res) => {
  res.json({ success: true, data: await departmentService.getDepartment(req.auth, req.params.id) });
};

const createDepartment = async (req, res) => {
  res.status(201).json({ success: true, data: await departmentService.createDepartment(req.auth, req.body) });
};

const updateDepartment = async (req, res) => {
  res.json({ success: true, data: await departmentService.updateDepartment(req.auth, req.params.id, req.body) });
};

const deleteDepartment = async (req, res) => {
  res.json({ success: true, data: await departmentService.deleteDepartment(req.auth, req.params.id) });
};

module.exports = { listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment };
