const contractDocumentService = require("../services/contractDocument.service");
const { sendPdf } = require("../services/contractFiles.service");

const uploadDocuments = async (req, res) => {
  res.status(201).json({ success: true, data: await contractDocumentService.uploadDocuments(req.auth, req.files, req.lang) });
};

const listDocuments = async (req, res) => {
  res.json({ success: true, data: await contractDocumentService.listDocuments(req.auth, req.query) });
};

const updateDocument = async (req, res) => {
  res.json({ success: true, data: await contractDocumentService.updateDocument(req.auth, req.params.id, req.body) });
};

const deleteDocument = async (req, res) => {
  res.json({ success: true, data: await contractDocumentService.deleteDocument(req.auth, req.params.id) });
};

const documentFile = async (req, res) => {
  const { bytes, fileName } = await contractDocumentService.documentFile(req.auth, req.params.id);
  sendPdf(res, bytes, { fileName, inline: true });
};

module.exports = { uploadDocuments, listDocuments, updateDocument, deleteDocument, documentFile };
