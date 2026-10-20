const employeeService = require("../services/employee.service");

const createEmployee = async (req, res) => {
  res.status(201).json({ success: true, data: await employeeService.createEmployee(req.auth, req.body) });
};

const checkUnique = async (req, res) => {
  res.json({ success: true, data: await employeeService.checkUnique(req.auth, req.query, req.lang) });
};

module.exports = { createEmployee, checkUnique };
