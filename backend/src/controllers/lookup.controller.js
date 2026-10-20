const lookupService = require("../services/lookup.service");

const listRoles = async (req, res) => {
  res.json({ success: true, data: await lookupService.listRoles(req.auth) });
};

const listStaffingCompanies = async (req, res) => {
  res.json({ success: true, data: await lookupService.listStaffingCompanies(req.auth, req.query) });
};

module.exports = { listRoles, listStaffingCompanies };
