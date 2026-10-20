const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const { render, visualRuns, ContractPdfError, MIN_SIZE } = require("../src/services/contractPdf.service");
const { makePng, openPdf, pageText, textInBox, operatorNames, paintedGlyphs } = require("./helpers/pdf");

// PDF rendering service (ticket contract-studio#11; plan decisions 38–40, ADR 0009).

const SOURCE = fs.readFileSync(path.resolve(__dirname, "../seed-assets/contracts/sample-contract.pdf"));
const SOURCE_SHA = crypto.createHash("sha256").update(SOURCE).digest("hex");
const A4 = { width: 595.28, height: 841.89 };
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

// Field box in points (same conversion as the service: origin top-left → bottom-left).
const boxPts = (f) => {
  const w = f.width * A4.width;
  const h = f.height * A4.height;
  return { x: f.pos_x * A4.width, y: A4.height - f.pos_y * A4.height - h, width: w, height: h };
};
const field = (values) => ({ page_no: 1, pos_x: 0.1, pos_y: 0.5, width: 0.5, height: 0.04, ...values });

// Arabic presentation forms → base letters (compatibility decomposition).
const base = (s) => s.normalize("NFKC");
const isPresentationForm = (ch) => /[ﭐ-﷿ﹰ-\uFEFF]/.test(ch);
// eslint-disable-next-line no-control-regex
const stripGaps = (s) => s.replace(/[\s\u0000-\u001f]/g, "");
// Only the Arabic letters (the sample page also carries Latin text).
const arabicOnly = (s) => s.replace(/[^؀-ۿ]/g, "");

describe("stamping values", () => {
  const png = makePng(120, 40);
  const fields = [
    field({ field_type: "INPUT", value: "Senior Engineer", pos_y: 0.35 }),
    field({ field_type: "DB_COLUMN", value: "Sara Khan", pos_y: 0.41 }),
    field({ field_type: "DATE", value: "16 Jan 2023", pos_y: 0.47 }),
    field({ field_type: "INITIALS", value: { type: "TYPED", text: "SK" }, pos_y: 0.53, width: 0.1 }),
    field({ field_type: "SIGNATURE", value: { type: "TYPED", text: "Sara Khan" }, pos_y: 0.59, height: 0.06 }),
    field({ field_type: "CHECKBOX", value: "true", pos_y: 0.67, width: 0.03, height: 0.02 }),
    field({ field_type: "SIGNATURE", value: { type: "DRAWN", png, sha256: sha(png) }, page_no: 2, pos_y: 0.6, height: 0.08 }),
  ];
  let doc;

  beforeAll(async () => {
    const { bytes } = await render({ sourceBytes: SOURCE, sourceSha256: SOURCE_SHA, fields, mode: "preview" });
    doc = await openPdf(bytes);
  });

  it.each([
    ["INPUT", 0, "Senior Engineer"],
    ["DB_COLUMN", 1, "Sara Khan"],
    ["DATE", 2, "16 Jan 2023"],
    ["typed INITIALS", 3, "SK"],
    ["typed SIGNATURE", 4, "Sara Khan"],
  ])("draws the %s value inside its box", async (_, index, expected) => {
    const items = await pageText(doc, 1);
    const inBox = textInBox(items, boxPts(fields[index]));
    expect(inBox.map((i) => i.str).join("")).toBe(expected);
    inBox.forEach((i) => expect(i.x + i.width).toBeLessThanOrEqual(boxPts(fields[index]).x + boxPts(fields[index]).width + 0.5));
  });

  it("draws a check mark for a ticked checkbox", async () => {
    const ops = await operatorNames(doc, 1);
    expect(ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(2);
  });

  it("draws a drawn signature as an image on its page", async () => {
    expect(await operatorNames(doc, 2)).toContain("paintImageXObject");
    expect(await operatorNames(doc, 1)).not.toContain("paintImageXObject");
  });

  it("leaves an unticked checkbox and empty values blank", async () => {
    const { bytes } = await render({
      sourceBytes: SOURCE,
      fields: [field({ field_type: "CHECKBOX", value: "false" }), field({ field_type: "INPUT", value: "" }), field({ field_type: "INPUT", value: null })],
    });
    const plain = await render({ sourceBytes: SOURCE });
    const d = await openPdf(bytes);
    const p = await openPdf(plain.bytes);
    expect(await operatorNames(d, 1)).toEqual(await operatorNames(p, 1));
  });
});

describe("shrink to fit", () => {
  it("shrinks a long value down to fit its box, never below 6 pt", async () => {
    const f = field({ field_type: "INPUT", value: "A rather long designation title for this box", width: 0.25 });
    const { bytes } = await render({ sourceBytes: SOURCE, fields: [f] });
    const items = textInBox(await pageText(await openPdf(bytes), 1), boxPts(f));
    expect(items.map((i) => i.str).join("")).toBe(f.value);
    items.forEach((i) => {
      expect(i.fontSize).toBeGreaterThanOrEqual(MIN_SIZE - 0.01);
      expect(i.fontSize).toBeLessThan(12);
      expect(i.x + i.width).toBeLessThanOrEqual(boxPts(f).x + boxPts(f).width + 0.5);
    });
  });

  it("clips a value too long even at 6 pt instead of spilling outside", async () => {
    const f = field({ field_type: "INPUT", value: "x".repeat(400), width: 0.1 });
    const { bytes } = await render({ sourceBytes: SOURCE, fields: [f] });
    const items = textInBox(await pageText(await openPdf(bytes), 1), boxPts(f));
    const right = Math.max(...items.map((i) => i.x + i.width));
    expect(right).toBeLessThanOrEqual(boxPts(f).x + boxPts(f).width + 0.5);
    items.forEach((i) => expect(i.fontSize).toBeCloseTo(MIN_SIZE, 1));
    expect(items.map((i) => i.str).join("").length).toBeLessThan(400);
  });
});

describe("Arabic", () => {
  it("draws an Arabic name joined and right to left", async () => {
    const name = "محمد أحمد";
    const f = field({ field_type: "DB_COLUMN", value: name });
    const { bytes } = await render({ sourceBytes: SOURCE, fields: [f] });
    const items = textInBox(await pageText(await openPdf(bytes), 1), boxPts(f));
    // pdf.js may read gaps between non-joining letters back as spaces or control characters.
    const drawn = stripGaps(items.map((i) => i.str).join(""));
    // Joined: every letter is a contextual (presentation) form, not a bare letter.
    [...drawn].forEach((ch) => expect(isPresentationForm(ch)).toBe(true));
    // Right to left: painted left to right, the glyphs are the logical text reversed.
    const painted = await paintedGlyphs(await openPdf(bytes), 1);
    expect(arabicOnly(base(painted))).toBe(stripGaps([...name].reverse().join("")));
  });

  it("paints a typed Arabic signature and an Arabic input right to left", async () => {
    const sig = field({ field_type: "SIGNATURE", value: { type: "TYPED", text: "سارة خان" }, height: 0.06 });
    const { bytes } = await render({ sourceBytes: SOURCE, fields: [sig] });
    expect(arabicOnly(base(await paintedGlyphs(await openPdf(bytes), 1)))).toBe(stripGaps([..."سارة خان"].reverse().join("")));
    const input = field({ field_type: "INPUT", value: "مهندس موقع" });
    const out = await render({ sourceBytes: SOURCE, fields: [input] });
    expect(arabicOnly(base(await paintedGlyphs(await openPdf(out.bytes), 1)))).toBe(stripGaps([..."مهندس موقع"].reverse().join("")));
  });

  it("draws mixed Arabic and Latin in visual order", async () => {
    const f = field({ field_type: "INPUT", value: "Ali علي 2026" });
    const { bytes } = await render({ sourceBytes: SOURCE, fields: [f] });
    const items = textInBox(await pageText(await openPdf(bytes), 1), boxPts(f));
    // pdf.js merges the two Latin runs into one item; the Arabic one must sit between them.
    const latin = items.find((i) => i.str.startsWith("Ali"));
    const arabic = items.find((i) => /[؀-ۿﭐ-\uFEFF]/.test(i.str));
    expect(latin.str.replace(/\s+/g, " ")).toBe("Ali 2026");
    expect(arabic).toBeDefined();
    expect(arabicOnly(base(await paintedGlyphs(await openPdf(bytes), 1)))).toBe([..."علي"].reverse().join(""));
    expect(arabic.x).toBeGreaterThan(latin.x);
    // Unicode bidi: a number after Arabic belongs to the RTL run, so left to right it reads
    // "Ali", then "2026 علي" mirrored.
    expect(visualRuns("Ali علي 2026").map((r) => base(r.text))).toEqual(["Ali 2026 ", [..."علي"].reverse().join("")]);
  });
});

describe("preview", () => {
  it("watermarks every page 'Not final' and adds no certificate page", async () => {
    const { bytes } = await render({ sourceBytes: SOURCE, fields: [], mode: "preview" });
    const doc = await openPdf(bytes);
    expect(doc.numPages).toBe(3);
    for (let p = 1; p <= 3; p += 1) {
      const text = (await pageText(doc, p)).map((i) => i.str);
      expect(text).toContain("Not final");
      expect(text).not.toContain("Certificate of completion");
    }
  });
});

describe("final", () => {
  const certificate = {
    contractNo: "CON-2026-0001",
    contractType: "Employment Contract",
    documentSha256: SOURCE_SHA,
    evidence: {
      signerName: "سارة خان",
      accountId: "acc-1",
      userId: "user-1",
      employeeId: "emp-1",
      signedAtUtc: "2026-10-20T09:30:00.000Z",
      ip: "203.0.113.7",
      userAgent: "Mozilla/5.0 (Test)",
      consentText: "I agree that my electronic signature is legally binding, the same as a handwritten signature.",
      consentVersion: "v1",
      valuesSha256: "d".repeat(64),
      signatures: [{ field: "Signature", sha256: "e".repeat(64) }],
    },
    approverName: "Owner Person",
    approvedAtUtc: "2026-10-21T08:00:00.000Z",
    approvedAtLocal: "21 Oct 2026, 11:00",
    timezone: "Asia/Riyadh",
  };

  it("flattens form fields and appends the certificate page with number, type, hash, evidence, approver and times", async () => {
    // A source that already has a form field.
    const src = await PDFDocument.load(SOURCE);
    src.getForm().createTextField("existing.name").addToPage(src.getPage(0), { x: 50, y: 50, width: 100, height: 20 });
    const withForm = Buffer.from(await src.save());

    const { bytes, sha256 } = await render({ sourceBytes: withForm, fields: [field({ field_type: "INPUT", value: "x" })], mode: "final", certificate });
    expect(sha256).toBe(sha(bytes));
    const out = await PDFDocument.load(bytes);
    expect(out.getForm().getFields()).toHaveLength(0);
    expect(out.getPageCount()).toBe(4);

    const doc = await openPdf(bytes);
    const text = (await pageText(doc, 4)).map((i) => i.str).join("\n");
    for (const expected of [
      "Certificate of completion",
      "CON-2026-0001",
      "Employment Contract",
      SOURCE_SHA,
      "203.0.113.7",
      "Mozilla/5.0 (Test)",
      "2026-10-20T09:30:00.000Z",
      "Owner Person",
      "2026-10-21T08:00:00.000Z",
      "21 Oct 2026, 11:00",
      "d".repeat(64),
      "e".repeat(64),
    ]) {
      expect(text).toContain(expected);
    }
    expect(arabicOnly(base(await paintedGlyphs(doc, 4)))).toContain(stripGaps([..."سارة خان"].reverse().join("")));
    expect((await pageText(doc, 1)).map((i) => i.str)).not.toContain("Not final");
  });
});

describe("failures", () => {
  it.each([
    ["missing", undefined],
    ["empty", Buffer.alloc(0)],
    ["broken", Buffer.from("%PDF-1.7 this is not a pdf")],
  ])("reports a %s source PDF clearly", async (_, sourceBytes) => {
    await expect(render({ sourceBytes })).rejects.toMatchObject({ name: "ContractPdfError", reason: "SOURCE_INVALID" });
  });

  it("refuses a source PDF that doesn't match its stored SHA-256", async () => {
    const err = await render({ sourceBytes: SOURCE, sourceSha256: "0".repeat(64) }).catch((e) => e);
    expect(err).toBeInstanceOf(ContractPdfError);
    expect(err.reason).toBe("INTEGRITY");
  });

  it("refuses a signature image that doesn't match its stored SHA-256", async () => {
    const png = makePng(10, 10);
    const f = field({ field_type: "SIGNATURE", value: { type: "DRAWN", png, sha256: "0".repeat(64) } });
    await expect(render({ sourceBytes: SOURCE, fields: [f] })).rejects.toMatchObject({ reason: "INTEGRITY" });
  });
});
