const officeService = require("../services/office.service");

const listOffices = async (req, res) => {
  res.json({ success: true, data: await officeService.listOffices(req.auth, req.query, req.lang) });
};

const getOffice = async (req, res) => {
  res.json({ success: true, data: await officeService.getOffice(req.auth, req.params.id, req.lang) });
};

const createOffice = async (req, res) => {
  res.status(201).json({ success: true, data: await officeService.createOffice(req.auth, req.body, req.lang) });
};

const updateOffice = async (req, res) => {
  res.json({ success: true, data: await officeService.updateOffice(req.auth, req.params.id, req.body, req.lang) });
};

const deleteOffice = async (req, res) => {
  res.json({ success: true, data: await officeService.deleteOffice(req.auth, req.params.id) });
};

const uploadImage = async (req, res) => {
  res.json({ success: true, data: await officeService.replaceImage(req.auth, req.params.id, req.file, req.lang) });
};

const deleteImage = async (req, res) => {
  res.json({ success: true, data: await officeService.removeImage(req.auth, req.params.id, req.lang) });
};

module.exports = { listOffices, getOffice, createOffice, updateOffice, deleteOffice, uploadImage, deleteImage };
