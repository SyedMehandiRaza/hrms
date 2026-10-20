const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Private contract storage for this file, before the app loads.
const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-contract-docs-"));
process.env.CONTRACT_STORAGE_DIR = STORAGE_DIR;

const { PDFDocument, PDFName, PDFString } = require("pdf-lib");
const h = require("./helpers/contracts");

const { db, app, request, errorBody, validationBody, createCompany, hrLogin, ownerToken, createEmployee, createStaffingCompany } = h;

// Contract documents API (ticket contract-studio#04; plan decisions 6–8).

afterAll(async () => {
  await db.sequelize.close();
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

const SAMPLE = fs.readFileSync(path.resolve(__dirname, "../seed-assets/contracts/sample-contract.pdf"));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

// ---------- test PDFs ----------
const pdfWithPages = async (pages) => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) pdf.addPage([200, 200]);
  return Buffer.from(await pdf.save());
};
const pdfWithJavaScript = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  const action = pdf.context.obj({ Type: "Action", S: "JavaScript", JS: PDFString.of("app.alert('hi')") });
  pdf.catalog.set(PDFName.of("OpenAction"), action);
  return Buffer.from(await pdf.save()); // object streams on: the action is compressed
};
// Script actions nested inside other objects, not at an object's top level (decision 6).
const pdfWithLinkScript = async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([200, 200]);
  const annot = pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [0, 0, 100, 100],
    A: { S: "JavaScript", JS: PDFString.of("app.alert('hi')") },
  });
  page.node.set(PDFName.of("Annots"), pdf.context.obj([annot]));
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
};
const pdfWithNameTreeScript = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  const action = pdf.context.obj({ S: "JavaScript", JS: PDFString.of("app.alert('hi')") });
  const names = pdf.context.obj({ Names: [PDFString.of("x"), action] });
  pdf.catalog.set(PDFName.of("Names"), pdf.context.register(pdf.context.obj({ Dests: names })));
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
};
const pdfWithAttachment = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  await pdf.attach(Buffer.from("hello"), "note.txt", { mimeType: "text/plain" });
  return Buffer.from(await pdf.save());
};
const encryptedPdf = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  const text = Buffer.from(await pdf.save({ useObjectStreams: false })).toString("latin1");
  return Buffer.from(text.replace(/trailer\s*<</, "trailer\n<<\n/Encrypt 1 0 R"), "latin1");
};
const tooBig = () => Buffer.concat([SAMPLE, Buffer.alloc(20 * 1024 * 1024 - SAMPLE.length + 1, 0x20)]);
const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(200, 1)]);

const upload = (token, files, lang) => {
  let req = request(app).post("/api/contract-documents");
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  if (lang) req = req.set("Accept-Language", lang);
  files.forEach(([buffer, name]) => {
    req = req.attach("files", buffer, name);
  });
  return req;
};
const list = (token, query) => h.api.get("/contract-documents", token, { query });
const patch = (token, id, body) => h.api.patch(`/contract-documents/${id}`, token, body);
const remove = (token, id) => h.api.delete(`/contract-documents/${id}`, token);
const file = (token, id) => h.api.get(`/contract-documents/${id}/file`, token).buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
});

const invalid = (fileName) => ({ fileName, ...errorBody("CONTRACT_DOCUMENT_INVALID") });

describe("upload", () => {
  let company;
  let token;

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
  });

  it("saves two valid PDFs with name, real page count, size and SHA-256, privately", async () => {
    const five = await pdfWithPages(5);
    const res = await upload(token, [
      [SAMPLE, "Employment Contract.pdf"],
      [five, "five-pages.PDF"],
    ]);
    expect(res.status).toBe(201);
    expect(res.body.data.errors).toEqual([]);
    const [a, b] = res.body.data.items;
    expect(a).toMatchObject({ name: "Employment Contract", original_file_name: "Employment Contract.pdf", page_count: 3, file_size_bytes: SAMPLE.length, status: "SAVED" });
    expect(b).toMatchObject({ name: "five-pages", page_count: 5, file_size_bytes: five.length });

    const row = await db.ContractDocument.findByPk(a.id);
    expect(row.file_sha256).toBe(sha(SAMPLE));
    expect(row.file_path).toMatch(new RegExp(`^${company.employer.id}/documents/[0-9a-f-]{36}\\.pdf$`));
    expect(row.uploaded_by).toBe(company.owner.id);
    expect(fs.readFileSync(path.join(STORAGE_DIR, row.file_path)).equals(SAMPLE)).toBe(true);
    expect(res.body.data.items[0]).not.toHaveProperty("file_path");
  });

  it("refuses each bad file with the exact message and still saves the valid ones", async () => {
    const files = [
      [docx, "contract.docx"],
      [Buffer.from("just some text"), "renamed.pdf"],
      [tooBig(), "huge.pdf"],
      [await pdfWithPages(51), "long.pdf"],
      [await encryptedPdf(), "locked.pdf"],
      [Buffer.from("%PDF-1.7 not really a pdf"), "broken.pdf"],
      [await pdfWithJavaScript(), "script.pdf"],
      [await pdfWithAttachment(), "attachment.pdf"],
      [SAMPLE, "good.pdf"],
    ];
    const res = await upload(token, files);
    expect(res.status).toBe(201);
    expect(res.body.data.items.map((d) => d.name)).toEqual(["good"]);
    expect(res.body.data.errors).toEqual(files.slice(0, 8).map(([, name]) => invalid(name)));
  });

  it("refuses scripts nested inside annotations and name trees", async () => {
    const files = [
      [await pdfWithLinkScript(), "link-script.pdf"],
      [await pdfWithNameTreeScript(), "nested-script.pdf"],
    ];
    const res = await upload(token, files);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.errors).toEqual(files.map(([, name]) => invalid(name)));
  });

  it("accepts exactly 50 pages", async () => {
    const res = await upload(token, [[await pdfWithPages(50), "fifty.pdf"]]);
    expect(res.body.data.items[0].page_count).toBe(50);
  });

  it("answers the per-file message in Arabic", async () => {
    const res = await upload(token, [[docx, "a.docx"]], "ar");
    expect(res.body.data.errors).toEqual([{ fileName: "a.docx", ...errorBody("CONTRACT_DOCUMENT_INVALID", "ar") }]);
  });

  it("refuses 11 files at once → 400 CONTRACT_UPLOAD_LIMIT, none saved", async () => {
    const before = await db.ContractDocument.count({ where: { employer_id: company.employer.id } });
    const res = await upload(token, Array.from({ length: 11 }, (_, i) => [SAMPLE, `f${i}.pdf`]));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("CONTRACT_UPLOAD_LIMIT"));
    expect(await db.ContractDocument.count({ where: { employer_id: company.employer.id } })).toBe(before);
  });

  it("accepts 10 files at once", async () => {
    const res = await upload(token, Array.from({ length: 10 }, (_, i) => [SAMPLE, `ten${i}.pdf`]));
    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(10);
  });

  it("refuses a request with no file", async () => {
    const res = await upload(token, []);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("CONTRACT_DOCUMENT_INVALID"));
  });
});

describe("list, rename, archive, delete and download", () => {
  let company;
  let token;

  const uploadOne = async (name = "Doc.pdf", bytes = SAMPLE) => (await upload(token, [[bytes, name]])).body.data.items[0];

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
  });

  it("lists the company's documents with search and status filter, paginated", async () => {
    const a = await uploadOne("Alpha Agreement.pdf");
    const b = await uploadOne("Beta Agreement.pdf");
    await patch(token, b.id, { status: "ARCHIVED" });
    await uploadOne.call(null, "Other.pdf");
    const all = await list(token, { limit: 2 });
    expect(all.status).toBe(200);
    expect(all.body.data).toMatchObject({ total: 3, limit: 2 });
    expect((await list(token, { search: "agreement" })).body.data.items.map((d) => d.id).sort()).toEqual([a.id, b.id].sort());
    expect((await list(token, { status: "ARCHIVED" })).body.data.items.map((d) => d.id)).toEqual([b.id]);
  });

  it("renames a document", async () => {
    const doc = await uploadOne();
    const res = await patch(token, doc.id, { name: "Renamed Contract" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed Contract");
  });

  it.each([
    [{ name: "" }, { name: "documentNameRequired" }],
    [{ name: "   " }, { name: "documentNameRequired" }],
    [{ name: "n".repeat(256) }, { name: "documentNameMax" }],
  ])("400 for rename %j", async (body, fields) => {
    const doc = await uploadOne();
    const res = await patch(token, doc.id, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(fields));
  });

  it("archives a document, which stays downloadable, and unarchives it", async () => {
    const doc = await uploadOne();
    expect((await patch(token, doc.id, { status: "ARCHIVED" })).body.data.status).toBe("ARCHIVED");
    const dl = await file(token, doc.id);
    expect(dl.status).toBe(200);
    expect(dl.body.equals(SAMPLE)).toBe(true);
    expect((await patch(token, doc.id, { status: "SAVED" })).body.data.status).toBe("SAVED");
  });

  it("downloads the original bytes inline with no-store and nosniff", async () => {
    const doc = await uploadOne("Inline.pdf");
    const res = await file(token, doc.id);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toMatch(/^inline/);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.body.equals(SAMPLE)).toBe(true);
  });

  it("500 when the stored file no longer matches its hash, and logs it", async () => {
    const doc = await uploadOne("Tampered.pdf");
    const row = await db.ContractDocument.findByPk(doc.id);
    fs.writeFileSync(path.join(STORAGE_DIR, row.file_path), Buffer.concat([SAMPLE, Buffer.from("x")]));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await h.api.get(`/contract-documents/${doc.id}/file`, token);
    expect(res.status).toBe(500);
    expect(res.body).toEqual(errorBody("INTERNAL_ERROR"));
    expect(spy.mock.calls.flat().join(" ")).toMatch(/contract file integrity check failed/);
    spy.mockRestore();
  });

  it("isn't reachable under /uploads by its stored path, or without logging in", async () => {
    const doc = await uploadOne();
    const row = await db.ContractDocument.findByPk(doc.id);
    expect((await request(app).get(`/uploads/${row.file_path}`)).status).toBe(404);
    const res = await h.api.get(`/contract-documents/${doc.id}/file`, undefined);
    expect(res.status).toBe(401);
  });

  it("refuses to delete a document used by a template or a contract → 409", async () => {
    const usedByTemplate = await uploadOne();
    await db.ContractTemplate.create({ employer_id: company.employer.id, name: "T", document_id: usedByTemplate.id });
    const usedByContract = await uploadOne();
    await db.Contract.create({ employer_id: company.employer.id, name: "C", document_id: usedByContract.id });
    for (const doc of [usedByTemplate, usedByContract]) {
      const res = await remove(token, doc.id);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("CONTRACT_DOCUMENT_IN_USE"));
    }
  });

  it("soft-deletes an unused document; it leaves the list", async () => {
    const doc = await uploadOne("Gone.pdf");
    const res = await remove(token, doc.id);
    expect(res.status).toBe(200);
    expect((await list(token, { search: "Gone" })).body.data.items).toEqual([]);
    const row = await db.ContractDocument.findByPk(doc.id, { paranoid: false });
    expect(row.deleted_at || row.deletedAt).not.toBeNull();
    expect((await file(token, doc.id)).status).toBe(404);
  });

  it.each(["patch", "remove", "file"])("404 for another company's document (%s)", async (action) => {
    const other = await createCompany();
    const foreign = (await upload(await ownerToken(other), [[SAMPLE, "Foreign.pdf"]])).body.data.items[0];
    const calls = { patch: () => patch(token, foreign.id, { name: "Mine" }), remove: () => remove(token, foreign.id), file: () => h.api.get(`/contract-documents/${foreign.id}/file`, token) };
    const res = await calls[action]();
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });
});

describe("permissions", () => {
  let company;
  let doc;

  beforeAll(async () => {
    company = await createCompany();
    doc = (await upload(await ownerToken(company), [[SAMPLE, "P.pdf"]])).body.data.items[0];
  });

  const calls = {
    list: (t) => list(t),
    file: (t) => h.api.get(`/contract-documents/${doc.id}/file`, t),
    upload: (t) => upload(t, [[SAMPLE, "x.pdf"]]),
    patch: (t) => patch(t, doc.id, { name: "Renamed" }),
    remove: (t) => remove(t, "00000000-0000-4000-a000-000000000000"),
  };
  const FLAG = { list: "can_read", file: "can_read", upload: "can_create", patch: "can_update", remove: "can_delete" };

  it.each(Object.keys(FLAG))("%s: 403 without its flag, allowed with it", async (action) => {
    const others = Object.fromEntries(["can_read", "can_create", "can_update", "can_delete"].filter((f) => f !== FLAG[action]).map((f) => [f, true]));
    const denied = await hrLogin(company.employer, others);
    const res = await calls[action](denied.token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    const allowed = await hrLogin(company.employer, { [FLAG[action]]: true });
    expect((await calls[action](allowed.token)).status).not.toBe(403);
  });

  it("403 for the employee and the staffing company", async () => {
    const { user: emp } = await createEmployee(company.employer);
    const { user: staff } = await createStaffingCompany(company.employer);
    for (const user of [emp, staff]) {
      const token = await h.loginAs(user.email);
      for (const call of Object.values(calls)) expect((await call(token)).status).toBe(403);
    }
  });
});

describe("private storage location", () => {
  it("refuses to start when CONTRACT_STORAGE_DIR is inside UPLOAD_DIR", () => {
    const run = spawnSync(process.execPath, ["-e", "require('./src/server')"], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, UPLOAD_DIR: "uploads", CONTRACT_STORAGE_DIR: "uploads/contracts", PORT: "0" },
      encoding: "utf8",
      timeout: 20000,
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/CONTRACT_STORAGE_DIR .* must not be inside UPLOAD_DIR/);
  });
});
