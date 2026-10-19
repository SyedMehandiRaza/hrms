const companyService = require("../services/company.service");

const getCompany = async (req, res) => {
  res.json({ success: true, data: await companyService.getCompany(req.auth) });
};

const updateCompany = async (req, res) => {
  res.json({ success: true, data: await companyService.updateProfile(req.auth, req.body) });
};

const uploadLogo = async (req, res) => {
  res.json({ success: true, data: await companyService.replaceLogo(req.auth, req.file) });
};

const deleteLogo = async (req, res) => {
  res.json({ success: true, data: await companyService.removeLogo(req.auth) });
};

const listIndustryTypes = async (req, res) => {
  res.json({ success: true, data: await companyService.listIndustryTypes() });
};

module.exports = { getCompany, updateCompany, uploadLogo, deleteLogo, listIndustryTypes };
