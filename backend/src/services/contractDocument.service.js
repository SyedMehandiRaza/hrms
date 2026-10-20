const path = require("path");
const { Op } = require("sequelize");
const { ContractDocument, ContractTemplate, Contract } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { translate } = require("../utils/i18n");
const { likePattern, UUID } = require("./department.service");
const { inspectPdf, saveNew, readVerified } = require("./contractFiles.service");

// Contract documents (plan decisions 6–8): PDF only, immutable (rename and archive only),
// stored privately, served only to HR with contract:read.

const toItem = (doc) => ({
  id: doc.id,
  name: doc.name,
  original_file_name: doc.original_file_name,
  page_count: doc.page_count,
  file_size_bytes: doc.file_size_bytes === null ? null : Number(doc.file_size_bytes),
  status: doc.status,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

const findDocument = async (employerId, id, options = {}) => {
  const doc = UUID.test(String(id)) ? await ContractDocument.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!doc) throw new ErrorHandler("NOT_FOUND");
  return doc;
};

// Document name from the file name: without its extension, at most 255 characters.
const nameFromFile = (fileName) => {
  const base = path.parse(String(fileName || "")).name.trim();
  return (base || "Document").slice(0, 255);
};

// POST /contract-documents. Each file is checked on its own; bad ones are listed in
// `errors` (code + message in the request language) and the good ones are saved.
const uploadDocuments = async ({ employerId, userId }, files, lang) => {
  if (!files || !files.length) throw new ErrorHandler("CONTRACT_DOCUMENT_INVALID");
  const items = [];
  const errors = [];
  for (const file of files) {
    const info = file.tooLarge ? null : await inspectPdf(file.buffer);
    if (!info) {
      errors.push({
        fileName: file.originalname,
        success: false,
        code: "CONTRACT_DOCUMENT_INVALID",
        message: translate("CONTRACT_DOCUMENT_INVALID", lang),
      });
      continue;
    }
    const stored = await saveNew(employerId, "documents", "pdf", file.buffer);
    const doc = await ContractDocument.create({
      employer_id: employerId,
      name: nameFromFile(file.originalname),
      original_file_name: String(file.originalname || "").slice(0, 255),
      file_path: stored.path,
      file_sha256: stored.sha256,
      file_type: "PDF",
      mime_type: "application/pdf",
      file_size_bytes: file.buffer.length,
      page_count: info.pageCount,
      status: "SAVED",
      uploaded_by: userId,
    });
    items.push(toItem(doc));
  }
  return { items, errors };
};

const listDocuments = async ({ employerId }, { page, limit, search, status }) => {
  const where = { employer_id: employerId };
  if (status) where.status = status;
  if (search) where.name = { [Op.like]: likePattern(search) };
  const { count, rows } = await ContractDocument.findAndCountAll({
    where,
    order: [
      ["createdAt", "DESC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: rows.map(toItem), total: count, page, limit };
};

// PATCH /contract-documents/:id { name?, status? }. The file itself never changes.
const updateDocument = async ({ employerId }, id, body) => {
  const doc = await findDocument(employerId, id);
  const changes = {};
  if (body.name !== undefined) changes.name = body.name;
  if (body.status !== undefined) changes.status = body.status;
  await doc.update(changes);
  return toItem(doc);
};

// Used by any template or contract (deleted ones too) → 409; otherwise a soft delete.
const deleteDocument = async ({ employerId }, id) => {
  const doc = await findDocument(employerId, id);
  const used =
    (await ContractTemplate.count({ where: { document_id: doc.id }, paranoid: false })) ||
    (await Contract.count({ where: { document_id: doc.id }, paranoid: false }));
  if (used) throw new ErrorHandler("CONTRACT_DOCUMENT_IN_USE");
  await doc.destroy();
  return { id: doc.id };
};

// GET /contract-documents/:id/file → { bytes, fileName } (integrity-checked).
const documentFile = async ({ employerId }, id) => {
  const doc = await findDocument(employerId, id);
  const bytes = await readVerified(doc.file_path, doc.file_sha256, { documentId: doc.id });
  return { bytes, fileName: doc.original_file_name || `${doc.name}.pdf` };
};

module.exports = { uploadDocuments, listDocuments, updateDocument, deleteDocument, documentFile, findDocument, toItem };
