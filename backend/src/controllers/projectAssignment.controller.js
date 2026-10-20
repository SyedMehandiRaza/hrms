const assignmentService = require("../services/projectAssignment.service");

const listWorkforce = async (req, res) => {
  res.json({ success: true, data: await assignmentService.listWorkforce(req.auth, req.params.id, req.query) });
};

const listAssignable = async (req, res) => {
  res.json({ success: true, data: await assignmentService.listAssignable(req.auth, req.params.id, req.query) });
};

const assignEmployees = async (req, res) => {
  res.json({ success: true, data: await assignmentService.assignEmployees(req.auth, req.params.id, req.body) });
};

const removeEmployee = async (req, res) => {
  res.json({ success: true, data: await assignmentService.removeEmployee(req.auth, req.params.id, req.params.employeeId) });
};

module.exports = { listWorkforce, listAssignable, assignEmployees, removeEmployee };
