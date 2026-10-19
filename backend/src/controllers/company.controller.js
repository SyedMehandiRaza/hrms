const companyService = require("../services/company.service");
const timeSettingsService = require("../services/timeSettings.service");

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

const getTimeSettings = async (req, res) => {
  res.json({ success: true, data: await timeSettingsService.getTimeSettings(req.auth) });
};

const updateTimeSettings = async (req, res) => {
  res.json({ success: true, data: await timeSettingsService.updateTimeSettings(req.auth, req.body) });
};

module.exports = {
  getCompany,
  updateCompany,
  uploadLogo,
  deleteLogo,
  listIndustryTypes,
  getTimeSettings,
  updateTimeSettings,
};
