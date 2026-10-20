const employeeService = require("../services/employee.service");
const employeeProfileService = require("../services/employeeProfile.service");
const employeeMainProjectService = require("../services/employeeMainProject.service");

const createEmployee = async (req, res) => {
  res.status(201).json({ success: true, data: await employeeService.createEmployee(req.auth, req.body) });
};

const checkUnique = async (req, res) => {
  res.json({ success: true, data: await employeeService.checkUnique(req.auth, req.query, req.lang) });
};

const updateEmployee = async (req, res) => {
  const id = await employeeService.updateEmployee(req.auth, req.params.id, req.body);
  res.json({ success: true, data: await employeeProfileService.getEmployee(req.auth, id, req.lang, { afterEdit: true }) });
};

const changeMainProject = async (req, res) => {
  const id = await employeeMainProjectService.changeMainProject(req.auth, req.params.id, req.body);
  res.json({ success: true, data: await employeeProfileService.getEmployee(req.auth, id, req.lang, { afterEdit: true }) });
};

const listEmployees = async (req, res) => {
  res.json({ success: true, data: await employeeProfileService.listEmployees(req.auth, req.query) });
};

const getEmployee = async (req, res) => {
  res.json({ success: true, data: await employeeProfileService.getEmployee(req.auth, req.params.id, req.lang) });
};

const bulkStatus = async (req, res) => {
  res.json({ success: true, data: await employeeProfileService.bulkStatus(req.auth, req.body) });
};

const resendLogin = async (req, res) => {
  res.json({ success: true, data: await employeeProfileService.resendLogin(req.auth, req.params.id) });
};

module.exports = { createEmployee, updateEmployee, changeMainProject, checkUnique, listEmployees, getEmployee, bulkStatus, resendLogin };
