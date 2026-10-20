const { sequelize, Contract, ContractField, ContractRecipient, ContractActivity, ContractDocument, Employee, StaffingCompany } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { isRealDate } = require("../utils/companyTime");
const { isRecipientActive } = require("./contractParties.service");
const { expireDue } = require("./contractExpiry.service");
const { findVisible } = require("./contractSigner.service");
const { contractItem } = require("./contract.service");
const { fieldsOf } = require("./contractQuery.service");
const { saveNew, sha256 } = require("./contractFiles.service");
const { valuesSha256 } = require("./contractMerge.service");
const storage = require("./storage.service");
const { emitContractEvent } = require("./contractEvents");

// Signing (plan decisions 29, 31–32, 37). Order of checks:
//   not visible → 404; state (decision 37); recipient inactive; consent; field values.
// Then, in one transaction: lock the row and re-check the state, write each drawn image
// under a new name, store values + write-once evidence, SUBMITTED, SIGNED activity. If
// anything after the image writes fails, the images are deleted and nothing is committed.

const CONSENT_TEXT = "I agree that my electronic signature is legally binding, the same as a handwritten signature.";
const CONSENT_VERSION = "v1";
const EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_BYTES = 500 * 1024;
const INPUT_MAX = 500;
const SIGNER_TYPES = ["INPUT", "CHECKBOX", "DATE", "INITIALS", "SIGNATURE"];

// The error a signer action gets for a contract's state, or null when it can go ahead.
const signerStateError = (c, now = new Date()) => {
  switch (c.status) {
    case "SUBMITTED":
    case "COMPLETED":
      return "CONTRACT_ALREADY_SIGNED";
    case "REVOKED":
      return "CONTRACT_REVOKED";
    case "EXPIRED":
      return "CONTRACT_EXPIRED";
    case "SENT":
    case "VIEWED":
      return c.expires_at && c.expires_at <= now ? "CONTRACT_EXPIRED" : null;
    default:
      return "CONTRACT_STATUS_INVALID";
  }
};

const blank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// data:image/png;base64,… → PNG bytes ≤ 500 KB (decoded), else null.
const decodePng = (dataUrl) => {
  const m = typeof dataUrl === "string" && /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length > MAX_IMAGE_BYTES || bytes.length < PNG_MAGIC.length || !bytes.subarray(0, 8).equals(PNG_MAGIC)) return null;
  return bytes;
};

// One field's submitted value → { value } (normalized) or { error: messageKey }.
const checkValue = (field, raw) => {
  if (blank(raw)) return field.is_required ? { error: "fieldRequired" } : { value: null };
  switch (field.field_type) {
    case "INPUT": {
      if (typeof raw !== "string") return { error: "VALIDATION_FAILED" };
      const text = raw.trim();
      if (text.length > INPUT_MAX) return { error: "inputMax500" };
      if (EMOJI.test(text)) return { error: "noEmojis" };
      return { value: text };
    }
    case "CHECKBOX":
      if (typeof raw !== "boolean") return { error: "VALIDATION_FAILED" };
      if (field.is_required && raw !== true) return { error: "fieldRequired" };
      return { value: raw ? "true" : "false" };
    case "DATE":
      return typeof raw === "string" && isRealDate(raw.trim()) ? { value: raw.trim() } : { error: "dateInvalid" };
    case "SIGNATURE":
    case "INITIALS": {
      if (!raw || typeof raw !== "object") return { error: "signatureImageInvalid" };
      if (raw.type === "TYPED" && typeof raw.text === "string") {
        const text = raw.text.trim();
        const [min, max, key] = field.field_type === "SIGNATURE" ? [2, 100, "signatureLength"] : [1, 10, "initialsLength"];
        if (EMOJI.test(text)) return { error: "noEmojis" };
        if (text.length < min || text.length > max) return { error: key };
        return { value: { type: "TYPED", text } };
      }
      if (raw.type === "DRAWN") {
        const png = decodePng(raw.dataUrl);
        return png ? { value: { type: "DRAWN", png } } : { error: "signatureImageInvalid" };
      }
      return { error: "signatureImageInvalid" };
    }
    default:
      return { value: null };
  }
};

// Unknown ids and merge-field ids in the body are ignored (decision 29).
const checkFields = (fields, submitted) => {
  const values = new Map();
  const errors = {};
  const body = submitted && typeof submitted === "object" && !Array.isArray(submitted) ? submitted : {};
  fields
    .filter((f) => SIGNER_TYPES.includes(f.field_type))
    .forEach((f) => {
      const result = checkValue(f, body[f.id]);
      if (result.error) errors[f.id] = result.error;
      else values.set(f.id, result.value);
    });
  if (Object.keys(errors).length) throw new ErrorHandler("VALIDATION_FAILED", { errors });
  return values;
};

const profileOf = async (contract, recipient) => {
  if (recipient.employee_id) {
    const e = await Employee.findByPk(recipient.employee_id, { paranoid: false, attributes: ["full_name"] });
    return { employee_id: recipient.employee_id, profile_name: e?.full_name ?? null };
  }
  const s = await StaffingCompany.findByPk(recipient.staffing_company_id, { paranoid: false, attributes: ["name"] });
  return { staffing_company_id: recipient.staffing_company_id, profile_name: s?.name ?? null };
};

// POST /my/contracts/:id/submit { fields: { [fieldId]: value }, consent: true }.
const submitContract = async (auth, id, body, { ip, userAgent }) => {
  await expireDue({ employerId: auth.employerId, contractId: id }).catch(() => {});
  const { contract } = await findVisible(auth, id);
  const stateError = signerStateError(contract);
  if (stateError) throw new ErrorHandler(stateError);
  const recipient = contract.contractRecipients[0];
  if (!(await isRecipientActive(auth.employerId, contract.audience_type, recipient.employee_id || recipient.staffing_company_id))) {
    throw new ErrorHandler("CONTRACT_RECIPIENT_INACTIVE");
  }
  if (!body || body.consent !== true) throw new ErrorHandler("CONTRACT_CONSENT_REQUIRED");
  const fields = await ContractField.findAll({ where: { contract_id: contract.id } });
  const values = checkFields(fields, body.fields);

  const document = await ContractDocument.findByPk(contract.document_id, { paranoid: false, attributes: ["file_sha256"] });
  const profile = await profileOf(contract, recipient);
  const written = [];
  try {
    await sequelize.transaction(async (transaction) => {
      const locked = await Contract.findOne({ where: { id: contract.id }, transaction, lock: transaction.LOCK.UPDATE });
      const lockedError = signerStateError(locked);
      if (lockedError) throw new ErrorHandler(lockedError);

      const now = new Date();
      const signatures = [];
      const stored = new Map();
      for (const f of fields) {
        if (!values.has(f.id)) continue;
        let v = values.get(f.id);
        if (v && typeof v === "object" && v.type === "DRAWN") {
          const file = await saveNew(auth.employerId, "signatures", "png", v.png);
          written.push(file.path);
          v = { type: "DRAWN", path: file.path, sha256: file.sha256 };
          signatures.push({ field_id: f.id, type: "DRAWN", path: file.path, sha256: file.sha256 });
        } else if (v && typeof v === "object") {
          signatures.push({ field_id: f.id, type: "TYPED", text: v.text });
        }
        const text = v && typeof v === "object" ? JSON.stringify(v) : v;
        stored.set(f.id, { text, hashed: v && v.type === "DRAWN" ? v.sha256 : text });
        await f.update({ value: text, filled_at: text === null ? null : now }, { transaction });
      }
      const hash = valuesSha256(
        fields.map((f) => ({ id: f.id, field_type: f.field_type, value: stored.has(f.id) ? stored.get(f.id).hashed : f.value }))
      );
      const evidence = {
        account_id: auth.accountId,
        user_id: auth.userId,
        ...profile,
        signatures,
        signed_at: now.toISOString(),
        ip: ip || null,
        user_agent: userAgent ? String(userAgent).slice(0, 255) : null,
        consent_text: CONSENT_TEXT,
        consent_version: CONSENT_VERSION,
        document_sha256: document?.file_sha256 ?? null,
        values_sha256: hash,
      };
      await ContractRecipient.update(
        {
          status: "SUBMITTED",
          signed_at: now,
          submitted_at: now,
          signed_ip: evidence.ip ? String(evidence.ip).slice(0, 64) : null,
          signed_user_agent: evidence.user_agent,
          evidence,
        },
        { where: { id: recipient.id }, transaction }
      );
      await locked.update({ status: "SUBMITTED", submitted_at: now }, { transaction });
      await ContractActivity.create(
        {
          employer_id: auth.employerId,
          contract_id: contract.id,
          recipient_id: recipient.id,
          action: "SIGNED",
          actor_user_id: auth.userId,
          meta: { profile_name: profile.profile_name, signed_at: evidence.signed_at, ip: evidence.ip, values_sha256: hash, consent_version: CONSENT_VERSION },
        },
        { transaction }
      );
    });
  } catch (err) {
    await Promise.all(written.map((p) => storage.removePrivate(p).catch(() => {})));
    if (!(err instanceof ErrorHandler)) console.error("[contracts] submit failed", { contractId: contract.id, error: err.message });
    throw err;
  }
  await emitContractEvent("SIGNED", { contractId: contract.id });
  const fresh = (await findVisible(auth, id)).contract;
  return { ...contractItem(fresh), fields: await fieldsOf(fresh.id) };
};

module.exports = { submitContract, signerStateError, CONSENT_TEXT, CONSENT_VERSION, sha256 };
