const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const arabicReshaper = require("arabic-reshaper");
const bidi = require("bidi-js")();

// Contract PDFs with pdf-lib (plan decisions 38–40, ADR 0009).
//   render({ sourceBytes, sourceSha256, fields, mode, certificate })
//     mode "preview": values stamped, diagonal "Not final" watermark, no certificate page.
//     mode "final":   values stamped, every form field flattened, certificate page appended.
// Returns { bytes, sha256 }. Never stores anything: callers decide (decision 38).
// Values are drawn inside their box (page-relative decimals, origin top-left), shrunk to
// fit down to 6 pt and clipped, never spilling outside. Arabic goes through a reshaper
// (contextual forms) and the bidi algorithm (visual order); each run is drawn with the
// font of its script: Noto Naskh Arabic or Noto Sans (bundled, OFL).

const FONT_DIR = path.resolve(__dirname, "../../assets/fonts");
const LATIN_FONT = fs.readFileSync(path.join(FONT_DIR, "NotoSans-Regular.ttf"));
const ARABIC_FONT = fs.readFileSync(path.join(FONT_DIR, "NotoNaskhArabic-Regular.ttf"));

const MIN_SIZE = 6;
const MAX_SIZE = 12;
const TEXT_COLOR = rgb(0.05, 0.05, 0.25);

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

class ContractPdfError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = "ContractPdfError";
    this.reason = reason; // SOURCE_INVALID | INTEGRITY
  }
}

// Arabic letters, presentation forms and Arabic-Indic digits. Everything else (Latin,
// digits, spaces, punctuation) is drawn with Noto Sans.
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-\uFEFF]/;

// Logical text → visual-order runs [{ text, arabic }], left to right.
const visualRuns = (value) => {
  const text = String(value);
  if (!ARABIC.test(text)) return [{ text, arabic: false }];
  const shaped = arabicReshaper.convertArabic(text);
  const levels = bidi.getEmbeddingLevels(shaped);
  const chars = bidi.getReorderedString(shaped, levels);
  const runs = [];
  for (const ch of chars) {
    const last = runs[runs.length - 1];
    const arabic = ARABIC.test(ch);
    if (last && last.arabic === arabic) last.text += ch;
    else runs.push({ text: ch, arabic });
  }
  return runs;
};

// Width of the runs at a size.
const runsWidth = (runs, fonts, size) => runs.reduce((w, r) => w + (r.arabic ? fonts.arabic : fonts.latin).widthOfTextAtSize(r.text, size), 0);

// Drops characters from the end of the visual line until it fits at the minimum size.
const clipRuns = (runs, fonts, size, maxWidth) => {
  const out = runs.map((r) => ({ ...r }));
  while (out.length && runsWidth(out, fonts, size) > maxWidth) {
    const last = out[out.length - 1];
    last.text = last.text.slice(0, -1);
    if (!last.text) out.pop();
  }
  return out;
};

// Draws text inside the box: largest size ≤ 12 pt (and ≤ 70% of the box height) that fits,
// never below 6 pt; anything still too wide is clipped.
const drawTextInBox = (page, fonts, value, box, { maxSize = MAX_SIZE, color = TEXT_COLOR } = {}) => {
  let runs = visualRuns(value);
  let size = Math.max(MIN_SIZE, Math.min(maxSize, box.height * 0.7));
  while (size > MIN_SIZE && runsWidth(runs, fonts, size) > box.width) size -= 0.25;
  size = Math.max(size, MIN_SIZE);
  if (runsWidth(runs, fonts, size) > box.width) runs = clipRuns(runs, fonts, size, box.width);
  const y = box.y + Math.max(0, (box.height - size) / 2) + size * 0.2;
  let x = box.x;
  for (const run of runs) {
    const font = run.arabic ? fonts.arabic : fonts.latin;
    // A run of spaces only moves the pen (a lone subset space glyph extracts as a control char).
    // fontkit lays out an Arabic run right to left itself (it reverses the glyphs), so it
    // gets the run back in logical order and paints it in our visual order.
    const text = run.arabic ? [...run.text].reverse().join("") : run.text;
    if (run.text.trim()) page.drawText(text, { x, y, size, font, color });
    x += font.widthOfTextAtSize(run.text, size);
  }
  return { size, runs };
};

// Page-relative decimals (origin top-left) → PDF points (origin bottom-left).
const boxOf = (page, field) => {
  const { width, height } = page.getSize();
  const w = Number(field.width ?? 0.2) * width;
  const h = Number(field.height ?? 0.03) * height;
  return { x: Number(field.pos_x) * width, y: height - Number(field.pos_y) * height - h, width: w, height: h };
};

const drawCheck = (page, box) => {
  const s = Math.min(box.width, box.height);
  const x = box.x + (box.width - s) / 2;
  const y = box.y + (box.height - s) / 2;
  const thickness = Math.max(1, s / 10);
  page.drawLine({ start: { x: x + s * 0.15, y: y + s * 0.5 }, end: { x: x + s * 0.4, y: y + s * 0.2 }, thickness, color: TEXT_COLOR });
  page.drawLine({ start: { x: x + s * 0.4, y: y + s * 0.2 }, end: { x: x + s * 0.85, y: y + s * 0.85 }, thickness, color: TEXT_COLOR });
};

const drawImageInBox = async (pdf, page, png, box) => {
  const image = await pdf.embedPng(png);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h });
};

// One field. value: text for INPUT/DATE/DB_COLUMN; "true"/true for a ticked CHECKBOX;
// SIGNATURE/INITIALS: { type: "TYPED", text } or { type: "DRAWN", png: Buffer, sha256 }.
const stampField = async (pdf, fonts, field) => {
  const pages = pdf.getPages();
  const page = pages[Number(field.page_no) - 1];
  if (!page) return;
  const box = boxOf(page, field);
  const value = field.value;
  if (value === null || value === undefined || value === "") return;
  switch (field.field_type) {
    case "CHECKBOX":
      if (value === true || value === "true") drawCheck(page, box);
      return;
    case "SIGNATURE":
    case "INITIALS":
      if (value.type === "DRAWN") {
        if (value.sha256 && sha256(value.png) !== value.sha256) {
          throw new ContractPdfError("INTEGRITY", "signature image does not match its stored SHA-256");
        }
        await drawImageInBox(pdf, page, value.png, box);
      } else {
        drawTextInBox(page, fonts, value.text, box, { maxSize: 18 });
      }
      return;
    default:
      drawTextInBox(page, fonts, value, box);
  }
};

const drawWatermark = (page, font) => {
  const { width, height } = page.getSize();
  const text = "Not final";
  const size = Math.min(width, height) / 5;
  const textWidth = font.widthOfTextAtSize(text, size);
  const angle = Math.atan2(height, width);
  page.drawText(text, {
    x: width / 2 - (Math.cos(angle) * textWidth) / 2 + (Math.sin(angle) * size) / 3,
    y: height / 2 - (Math.sin(angle) * textWidth) / 2 - (Math.cos(angle) * size) / 3,
    size,
    font,
    color: rgb(0.85, 0.1, 0.1),
    opacity: 0.25,
    rotate: degrees((angle * 180) / Math.PI),
  });
};

// Certificate of completion (English, decision 38). `certificate` = { contractNo, contractType,
// documentSha256, evidence: { signerName, accountId, userId, employeeId?, staffingCompanyId?,
// signedAtUtc, ip, userAgent, consentText, consentVersion, valuesSha256, signatures: [{ field, sha256 }] },
// approverName, approvedAtUtc, approvedAtLocal, timezone }.
const addCertificate = (pdf, fonts, c) => {
  const page = pdf.addPage([595.28, 841.89]);
  const left = 50;
  const right = 545;
  let y = 780;
  const line = (label, value, size = 10) => {
    page.drawText(label, { x: left, y, size, font: fonts.latin, color: rgb(0.35, 0.35, 0.35) });
    drawTextInBox(page, fonts, value ?? "—", { x: left + 150, y: y - 3, width: right - left - 150, height: size + 6 }, { maxSize: size, color: rgb(0, 0, 0) });
    y -= size + 10;
  };
  page.drawText("Certificate of completion", { x: left, y, size: 20, font: fonts.latin });
  y -= 36;
  line("Contract number", c.contractNo);
  line("Contract type", c.contractType);
  line("Document SHA-256", c.documentSha256, 8);
  y -= 8;
  page.drawText("Signer", { x: left, y, size: 13, font: fonts.latin });
  y -= 22;
  const e = c.evidence || {};
  line("Name (profile)", e.signerName);
  line("Account ID", e.accountId, 8);
  line("User ID", e.userId, 8);
  if (e.employeeId) line("Employee ID", e.employeeId, 8);
  if (e.staffingCompanyId) line("Staffing company ID", e.staffingCompanyId, 8);
  line("Signed at (UTC)", e.signedAtUtc);
  line("IP address", e.ip);
  line("User agent", e.userAgent, 8);
  line("Consent", `${e.consentVersion || ""}: ${e.consentText || ""}`, 8);
  line("Values SHA-256", e.valuesSha256, 8);
  (e.signatures || []).forEach((s) => line(`Signature (${s.field})`, s.sha256 ? `image SHA-256 ${s.sha256}` : `typed: ${s.text}`, 8));
  y -= 8;
  page.drawText("Approval", { x: left, y, size: 13, font: fonts.latin });
  y -= 22;
  line("Approved by", c.approverName);
  line("Approved at (UTC)", c.approvedAtUtc);
  line(`Approved at (${c.timezone || "company time"})`, c.approvedAtLocal);
};

const loadSource = async (sourceBytes, sourceSha256) => {
  if (!sourceBytes || !sourceBytes.length) throw new ContractPdfError("SOURCE_INVALID", "source PDF is missing");
  if (sourceSha256 && sha256(sourceBytes) !== sourceSha256) {
    throw new ContractPdfError("INTEGRITY", "source PDF does not match its stored SHA-256");
  }
  try {
    const pdf = await PDFDocument.load(sourceBytes);
    // pdf-lib accepts some garbage; touching the page tree proves it's a usable PDF.
    if (pdf.getPageCount() < 1) throw new Error("no pages");
    return pdf;
  } catch (err) {
    throw new ContractPdfError("SOURCE_INVALID", `source PDF is unreadable: ${err.message}`);
  }
};

const render = async ({ sourceBytes, sourceSha256, fields = [], mode = "preview", certificate } = {}) => {
  const pdf = await loadSource(sourceBytes, sourceSha256);
  pdf.registerFontkit(fontkit);
  const fonts = {
    latin: await pdf.embedFont(LATIN_FONT, { subset: true }),
    arabic: await pdf.embedFont(ARABIC_FONT, { subset: true }),
  };
  for (const field of fields) await stampField(pdf, fonts, field);

  if (mode === "final") {
    pdf.getForm().flatten();
    addCertificate(pdf, fonts, certificate || {});
  } else {
    const watermarkFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    pdf.getPages().forEach((page) => drawWatermark(page, watermarkFont));
  }
  const bytes = Buffer.from(await pdf.save());
  return { bytes, sha256: sha256(bytes) };
};

module.exports = { render, sha256, visualRuns, ContractPdfError, MIN_SIZE };
