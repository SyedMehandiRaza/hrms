import client from "./client";

// Contract Studio endpoints (docs/plans/contract-studio.md, "Endpoints"). Each returns the
// response's `data`; PDF downloads return a Blob. Errors are axios errors: read them with
// utils/apiError.js / utils/applyFieldErrors.js.

const id = (value) => encodeURIComponent(value);
const data = (res) => res.data.data;
const blob = (url, params) => client.get(url, { params, responseType: "blob" }).then((res) => res.data);

// ---------- contract types ----------
// Item: { id, name, code, description, is_active, created_at, updated_at }
export const listContractTypes = ({ page = 1, limit = 10, search = "", status = "" } = {}) =>
  client.get("/contract-types", { params: { page, limit, search, status } }).then(data);
export const createContractType = (body) => client.post("/contract-types", body).then(data);
export const updateContractType = (typeId, body) => client.put(`/contract-types/${id(typeId)}`, body).then(data);
export const removeContractType = (typeId) => client.delete(`/contract-types/${id(typeId)}`).then(data);

// ---------- documents ----------
// Item: { id, name, original_file_name, page_count, file_size_bytes, status (SAVED|ARCHIVED), created_at }
export const listContractDocuments = ({ page = 1, limit = 50, search = "", status = "" } = {}) =>
  client.get("/contract-documents", { params: { page, limit, search, status } }).then(data);
// files: File[] → { items: [saved], errors: [{ fileName, code, message }] }
export const uploadContractDocuments = (files) => {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  return client.post("/contract-documents", form).then(data);
};
export const updateContractDocument = (docId, body) => client.patch(`/contract-documents/${id(docId)}`, body).then(data);
export const removeContractDocument = (docId) => client.delete(`/contract-documents/${id(docId)}`).then(data);
export const contractDocumentFile = (docId) => blob(`/contract-documents/${id(docId)}/file`);

// ---------- templates and merge fields ----------
export const listContractTemplates = ({ page = 1, limit = 50, search = "", status = "", audience = "" } = {}) =>
  client.get("/contract-templates", { params: { page, limit, search, status, audience } }).then(data);
export const getContractTemplate = (templateId) => client.get(`/contract-templates/${id(templateId)}`).then(data);
export const createContractTemplate = (body) => client.post("/contract-templates", body).then(data);
export const updateContractTemplate = (templateId, body) => client.put(`/contract-templates/${id(templateId)}`, body).then(data);
export const duplicateContractTemplate = (templateId) => client.post(`/contract-templates/${id(templateId)}/duplicate`).then(data);
export const setContractTemplateStatus = (templateId, status) =>
  client.patch(`/contract-templates/${id(templateId)}/status`, { status }).then(data);
export const removeContractTemplate = (templateId) => client.delete(`/contract-templates/${id(templateId)}`).then(data);
// → [{ source, group, fields: [{ token, label }] }]
export const listMergeFields = (audience) => client.get("/contract-merge-fields", { params: { audience } }).then(data);

// ---------- recipients ----------
export const lookupRecipients = ({ audience, projectId = "", staffingCompanyId = "", q = "", page = 1, limit = 100 } = {}) =>
  client.get("/contract-recipients", { params: { audience, projectId, staffingCompanyId, q, page, limit } }).then(data);

// ---------- contracts (HR) ----------
export const listContracts = ({ page = 1, limit = 10, q = "", status = "", audience = "", type = "" } = {}) =>
  client.get("/contracts", { params: { page, limit, q, status, audience, type } }).then(data);
export const contractStats = () => client.get("/contracts/stats").then(data);
export const getContract = (contractId) => client.get(`/contracts/${id(contractId)}`).then(data);
// body: { mode: "DRAFT"|"SEND", templateId, recipientIds, name?, start_date, … } → { results, sent, drafts, failed }
export const createContracts = (body) => client.post("/contracts", body).then(data);
export const editDraft = (contractId, body) => client.put(`/contracts/${id(contractId)}`, body).then(data);
export const deleteDraft = (contractId) => client.delete(`/contracts/${id(contractId)}`).then(data);
export const sendDraft = (contractId) => client.post(`/contracts/${id(contractId)}/send`).then(data);
export const approveContract = (contractId) => client.post(`/contracts/${id(contractId)}/approve`).then(data);
export const revokeContract = (contractId, reason) => client.post(`/contracts/${id(contractId)}/revoke`, { reason }).then(data);
export const contractPdf = (contractId) => blob(`/contracts/${id(contractId)}/pdf`);

// ---------- my contracts (signer) ----------
export const listMyContracts = ({ page = 1, limit = 10, q = "" } = {}) => client.get("/my/contracts", { params: { page, limit, q } }).then(data);
export const getMyContract = (contractId) => client.get(`/my/contracts/${id(contractId)}`).then(data);
export const myContractDocument = (contractId) => blob(`/my/contracts/${id(contractId)}/document`);
export const myContractPdf = (contractId) => blob(`/my/contracts/${id(contractId)}/pdf`);
// fields: { [fieldId]: value }, consent: true
export const submitMyContract = (contractId, body) => client.post(`/my/contracts/${id(contractId)}/submit`, body).then(data);
export const rejectMyContract = (contractId, reason) => client.post(`/my/contracts/${id(contractId)}/reject`, { reason }).then(data);

// Saves a Blob as a file download.
export const saveBlob = (fileBlob, fileName) => {
  const url = URL.createObjectURL(fileBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
