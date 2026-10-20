const projectService = require("../services/project.service");

const listProjects = async (req, res) => {
  res.json({ success: true, data: await projectService.listProjects(req.auth, req.query, req.lang) });
};

const officeOptions = async (req, res) => {
  res.json({ success: true, data: await projectService.officeOptions(req.auth, req.query) });
};

const getProject = async (req, res) => {
  res.json({ success: true, data: await projectService.getProject(req.auth, req.params.id, req.lang) });
};

const createProject = async (req, res) => {
  res.status(201).json({ success: true, data: await projectService.createProject(req.auth, req.body, req.lang) });
};

const updateProject = async (req, res) => {
  res.json({ success: true, data: await projectService.updateProject(req.auth, req.params.id, req.body, req.lang) });
};

const changeStatus = async (req, res) => {
  res.json({ success: true, data: await projectService.changeStatus(req.auth, req.params.id, req.body, req.lang) });
};

const uploadImage = async (req, res) => {
  res.json({ success: true, data: await projectService.replaceImage(req.auth, req.params.id, req.file, req.lang) });
};

const deleteImage = async (req, res) => {
  res.json({ success: true, data: await projectService.removeImage(req.auth, req.params.id, req.lang) });
};

module.exports = { listProjects, officeOptions, getProject, createProject, updateProject, changeStatus, uploadImage, deleteImage };
