const { ContractDocument, ContractField, ContractRecipient } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const pdf = require("./contractPdf.service");

const { ContractPdfError } = pdf;
const { readVerified } = require("./contractFiles.service");
const { resolveMergeValues } = require("./contractMerge.service");

// Builds a contract's PDF (plan decisions 38–39):
//   DRAFT              → preview with LIVE merge values, "Not final".
//   SENT … SUBMITTED   → preview with FROZEN values (and the signer's, once submitted).
//   COMPLETED          → the stored final PDF, integrity-checked.
// Signature/initials values are stored on the field as JSON:
//   { "type": "TYPED", "text": "…" } or { "type": "DRAWN", "path": "<private path>", "sha256": "…" }.

const parseSignature = (value) => {
  if (!value) return null;
  try {
    const v = JSON.parse(value);
    return v && (v.type === "TYPED" || v.type === "DRAWN") ? v : null;
  } catch {
    return null;
  }
};

// Field value as the renderer expects it (signature images loaded and checked).
const renderValue = async (field, value) => {
  if (field.field_type !== "SIGNATURE" && field.field_type !== "INITIALS") return value;
  const sig = parseSignature(value);
  if (!sig) return null;
  if (sig.type === "TYPED") return { type: "TYPED", text: sig.text };
  const png = await readVerified(sig.path, sig.sha256, { fieldId: field.id });
  return { type: "DRAWN", png, sha256: sig.sha256 };
};

const fileName = (contract) => `${contract.reference_no || contract.name}.pdf`;

// Renders and returns { bytes, fileName }. PDF problems → logged, 500.
const contractPdf = async (contract) => {
  if (contract.status === "COMPLETED" && contract.signed_pdf_path) {
    const bytes = await readVerified(contract.signed_pdf_path, contract.signed_pdf_sha256, { contractId: contract.id });
    return { bytes, fileName: fileName(contract) };
  }
  const document = await ContractDocument.findByPk(contract.document_id, { paranoid: false });
  if (!document) throw new ErrorHandler("INTERNAL_ERROR");
  const sourceBytes = await readVerified(document.file_path, document.file_sha256, { documentId: document.id });
  const fields = await ContractField.findAll({ where: { contract_id: contract.id } });

  let live = null;
  if (contract.status === "DRAFT") {
    const recipient = await ContractRecipient.findOne({ where: { contract_id: contract.id } });
    live = await resolveMergeValues({
      employerId: contract.employer_id,
      audience: contract.audience_type,
      recipientId: recipient.employee_id || recipient.staffing_company_id,
      contract: contract.get({ plain: true }),
      fields,
    });
  }
  const values = [];
  for (const f of fields) {
    const raw = live && f.field_type === "DB_COLUMN" ? live.values.get(f.id) : f.value;
    values.push({ ...f.get({ plain: true }), value: await renderValue(f, raw) });
  }
  try {
    const { bytes } = await pdf.render({ sourceBytes, sourceSha256: document.file_sha256, fields: values, mode: "preview" });
    return { bytes, fileName: fileName(contract) };
  } catch (err) {
    if (err instanceof ContractPdfError) {
      console.error("[contracts] contract file integrity check failed", { contractId: contract.id, error: err.message });
      throw new ErrorHandler("INTERNAL_ERROR");
    }
    throw err;
  }
};

// The final PDF at approval (decision 38): every frozen and signed value stamped, form
// fields flattened, certificate page appended. → { bytes, sha256 }. Throws ContractPdfError.
const buildFinalPdf = async (contract, certificate) => {
  const document = await ContractDocument.findByPk(contract.document_id, { paranoid: false });
  if (!document) throw new ContractPdfError("SOURCE_INVALID", "document missing");
  let sourceBytes;
  try {
    sourceBytes = await readVerified(document.file_path, document.file_sha256, { documentId: document.id });
  } catch {
    throw new ContractPdfError("INTEGRITY", "document unreadable or changed");
  }
  const fields = await ContractField.findAll({ where: { contract_id: contract.id } });
  const values = [];
  for (const f of fields) {
    let value;
    try {
      value = await renderValue(f, f.value);
    } catch {
      throw new ContractPdfError("INTEGRITY", "signature image unreadable or changed");
    }
    values.push({ ...f.get({ plain: true }), value });
  }
  return pdf.render({ sourceBytes, sourceSha256: document.file_sha256, fields: values, mode: "final", certificate });
};

module.exports = { contractPdf, buildFinalPdf, parseSignature, renderValue };
