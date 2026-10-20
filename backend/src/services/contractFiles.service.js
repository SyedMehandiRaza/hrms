const crypto = require("crypto");
const { PDFDocument, PDFDict, PDFName, PDFRawStream, PDFStream } = require("pdf-lib");
const storage = require("./storage.service");
const ErrorHandler = require("../utils/ErrorHandler");

// Private contract files (plan decisions 6, 8, 32): PDF inspection on upload, hashed
// writes and integrity-checked reads, and the download response headers.

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

const MAX_PAGES = 50;

// Active content a contract PDF may not carry (decision 6): dictionary keys and name values.
const FORBIDDEN_KEYS = new Set(["JS", "JavaScript", "OpenAction", "AA", "Launch", "EmbeddedFile", "EmbeddedFiles", "XFA"]);
const FORBIDDEN_NAMES = new Set(["JavaScript", "Launch", "EmbeddedFile"]);

const dictOf = (obj) => {
  if (obj instanceof PDFDict) return obj;
  if (obj instanceof PDFRawStream || obj instanceof PDFStream) return obj.dict;
  return null;
};

// Walks every object (object streams are already unpacked by pdf-lib).
const hasActiveContent = (pdf) => {
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    const dict = dictOf(obj);
    if (!dict) continue;
    for (const [key, value] of dict.entries()) {
      if (FORBIDDEN_KEYS.has(key.decodeText ? key.decodeText() : key.asString().slice(1))) return true;
      if (value instanceof PDFName && FORBIDDEN_NAMES.has(value.asString().slice(1))) return true;
    }
  }
  return false;
};

// → { pageCount } for an acceptable PDF, null otherwise (magic bytes, readable, not
// encrypted, ≤ 50 pages, no scripts / auto actions / embedded files / XFA).
const inspectPdf = async (bytes) => {
  if (!bytes || bytes.length < 5 || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  let pdf;
  try {
    pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    return null; // unreadable or encrypted (pdf-lib refuses encrypted files by default)
  }
  let pageCount;
  try {
    pageCount = pdf.getPageCount();
  } catch {
    return null;
  }
  if (pageCount < 1 || pageCount > MAX_PAGES) return null;
  if (hasActiveContent(pdf)) return null;
  return { pageCount };
};

// Writes under a new UUID name in the company's folder; returns { path, sha256 }.
const saveNew = async (employerId, folder, ext, bytes) => {
  const relativePath = `${employerId}/${folder}/${crypto.randomUUID()}.${ext}`;
  await storage.savePrivate(bytes, relativePath);
  return { path: relativePath, sha256: sha256(bytes) };
};

// Reads a stored file and checks it against its stored SHA-256. A missing or changed
// file is logged and answered with 500 INTERNAL_ERROR; nothing is served.
const readVerified = async (relativePath, expectedSha256, context = {}) => {
  let bytes;
  try {
    bytes = await storage.readPrivate(relativePath);
  } catch (err) {
    console.error("[contracts] contract file integrity check failed", { ...context, path: relativePath, error: err.code || err.message });
    throw new ErrorHandler("INTERNAL_ERROR");
  }
  if (expectedSha256 && sha256(bytes) !== expectedSha256) {
    console.error("[contracts] contract file integrity check failed", { ...context, path: relativePath, error: "SHA-256 mismatch" });
    throw new ErrorHandler("INTERNAL_ERROR");
  }
  return bytes;
};

// Content-Disposition with an ASCII fallback and the UTF-8 name (RFC 6266).
const disposition = (kind, fileName) => {
  const ascii = String(fileName).replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

// Decision 8: PDFs only through authenticated endpoints, never cached.
const sendPdf = (res, bytes, { fileName, inline }) => {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": disposition(inline ? "inline" : "attachment", fileName),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(bytes);
};

module.exports = { sha256, inspectPdf, saveNew, readVerified, sendPdf, MAX_PAGES };
