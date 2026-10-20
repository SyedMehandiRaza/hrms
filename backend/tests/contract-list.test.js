const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-contract-list-"));
process.env.CONTRACT_STORAGE_DIR = STORAGE_DIR;

const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");
const { openPdf, pageText } = require("./helpers/pdf");
const storage = require("../src/services/storage.service");

const { db, api, errorBody, createEmployee, createStaffingCompany, hrLogin } = h;
const { setupCompany, createContracts, draftsFor, terms, attachSampleFile, SAMPLE_PDF } = f;

// Contracts list, detail, stats and preview (ticket contract-studio#23; plan decisions 22, 36, 39, 42).

afterAll(async () => {
  await db.sequelize.close();
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

const list = (token, query) => api.get("/contracts", token, { query });
const stats = (token) => api.get("/contracts/stats", token);
const detail = (token, id) => api.get(`/contracts/${id}`, token);
const pdf = (token, id) =>
  api
    .get(`/contracts/${id}/pdf`, token)
    .buffer(true)
    .parse((res, cb) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
const send = (ctx, ids, overrides = {}) => createContracts(ctx.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: ids, ...terms(), ...overrides });
const newEmp = async (ctx, overrides = {}) => (await createEmployee(ctx.employer, { full_name: `Emp ${h.short()}`, ...overrides })).employee;
const allText = async (bytes) => {
  const doc = await openPdf(bytes);
  const out = [];
  for (let p = 1; p <= doc.numPages; p += 1) out.push(...(await pageText(doc, p)).map((i) => i.str));
  return out;
};

describe("list and stats", () => {
  let ctx;
  let ids;

  beforeAll(async () => {
    ctx = await setupCompany();
    const a = await newEmp(ctx, { full_name: "Sara Khan" });
    const b = await newEmp(ctx, { full_name: "Omar Farooq" });
    const sent = (await send(ctx, [a.id], { name: "Alpha Agreement" })).body.data.results[0].contractId;
    const draft = (await draftsFor(ctx, [b.id], { name: "Beta Agreement" })).body.data.results[0].contractId;
    const { company: s } = await createStaffingCompany(ctx.employer);
    const staffing = (await createContracts(ctx.token, { mode: "DRAFT", templateId: ctx.staffingTemplate.id, recipientIds: [s.id], ...terms() })).body.data.results[0].contractId;
    const deleted = (await draftsFor(ctx, [b.id], { name: "Deleted Draft" })).body.data.results[0].contractId;
    await api.delete(`/contracts/${deleted}`, ctx.token);
    ids = { sent, draft, staffing, deleted };
  });

  it("lists the company's contracts, newest first, paginated, without deleted drafts", async () => {
    const res = await list(ctx.token, { limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, limit: 2 });
    const all = (await list(ctx.token, { limit: 50 })).body.data.items;
    expect(all.map((c) => c.id)).not.toContain(ids.deleted);
    expect(all.find((c) => c.id === ids.sent)).toMatchObject({
      name: "Alpha Agreement",
      status: "SENT",
      audience_type: "EMPLOYEE",
      contract_type: { id: ctx.type.id, name: "Employment Contract" },
      recipient: { name: "Sara Khan", type: "EMPLOYEE" },
    });
    expect(all.find((c) => c.id === ids.sent).number).toMatch(/^CON-\d{4}-0001$/);
  });

  it("filters by status, audience and type, and searches name or number", async () => {
    const q = async (query) => (await list(ctx.token, query)).body.data.items.map((c) => c.id).sort();
    expect(await q({ status: "SENT" })).toEqual([ids.sent]);
    expect(await q({ status: "DRAFT" })).toEqual([ids.draft, ids.staffing].sort());
    expect(await q({ audience: "STAFFING_COMPANY" })).toEqual([ids.staffing]);
    expect(await q({ type: ctx.staffType.id })).toEqual([ids.staffing]);
    expect(await q({ q: "beta" })).toEqual([ids.draft]);
    expect(await q({ q: "0001" })).toEqual([ids.sent]);
  });

  it("counts by status and audience", async () => {
    const res = await stats(ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.byStatus).toMatchObject({ DRAFT: 2, SENT: 1, VIEWED: 0, SUBMITTED: 0, COMPLETED: 0, REJECTED: 0, EXPIRED: 0, REVOKED: 0 });
    expect(res.body.data.byAudience).toEqual({ EMPLOYEE: 2, STAFFING_COMPANY: 1 });
  });

  it("opens a contract with its recipient, fields and activity (newest first)", async () => {
    const res = await detail(ctx.token, ids.sent);
    expect(res.status).toBe(200);
    const c = res.body.data;
    expect(c).toMatchObject({ id: ids.sent, status: "SENT", recipient: { name: "Sara Khan", status: "SENT" } });
    expect(c.fields.map((x) => x.field_type).sort()).toEqual(["DB_COLUMN", "SIGNATURE"]);
    expect(c.fields.find((x) => x.field_type === "DB_COLUMN")).toMatchObject({ db_column: "employee_name", value: "Sara Khan" });
    expect(c.activity.map((a) => a.action)).toEqual(["SENT", "CREATED"]);
    expect(c.activity[0]).toMatchObject({ actor: { id: ctx.owner.id, name: "Owner Person" } });
  });

  it("shows a past-due SENT contract as EXPIRED with one EXPIRED activity, before any job runs", async () => {
    const e = await newEmp(ctx);
    const id = (await send(ctx, [e.id])).body.data.results[0].contractId;
    await db.Contract.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id } });
    expect((await list(ctx.token, { status: "EXPIRED" })).body.data.items.map((c) => c.id)).toEqual([id]);
    expect((await stats(ctx.token)).body.data.byStatus.EXPIRED).toBe(1);
    const d = (await detail(ctx.token, id)).body.data;
    expect(d.status).toBe("EXPIRED");
    expect(d.activity.filter((a) => a.action === "EXPIRED")).toHaveLength(1);
    expect(d.activity.find((a) => a.action === "EXPIRED").actor).toBeNull();
  });

  it("404 for another company's contract, its PDF, or a malformed id", async () => {
    const other = await setupCompany("Other");
    const e = await newEmp(other);
    const foreign = (await draftsFor(other, [e.id])).body.data.results[0].contractId;
    for (const res of [await detail(ctx.token, foreign), await pdf(ctx.token, foreign), await detail(ctx.token, "nope")]) {
      expect(res.status).toBe(404);
    }
    expect((await list(ctx.token, { limit: 100 })).body.data.items.map((c) => c.id)).not.toContain(foreign);
  });
});

describe("PDF downloads", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupCompany();
    await attachSampleFile(ctx.document);
  });

  it("downloads a draft with live merge values and a 'Not final' watermark, as an attachment", async () => {
    const e = await newEmp(ctx, { full_name: "Live Name" });
    const id = (await draftsFor(ctx, [e.id], { name: "Draft Doc" })).body.data.results[0].contractId;
    await e.update({ full_name: "Renamed Live" });
    const res = await pdf(ctx.token, id);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="Draft Doc\.pdf"/);
    expect(res.headers["cache-control"]).toBe("no-store");
    const text = await allText(res.body);
    expect(text).toContain("Renamed Live");
    expect(text).toContain("Not final");
    expect(text).not.toContain("Certificate of completion");
  });

  it("downloads a SENT contract with frozen values and the watermark, named after its number", async () => {
    const e = await newEmp(ctx, { full_name: "Frozen Name" });
    const id = (await send(ctx, [e.id])).body.data.results[0].contractId;
    await e.update({ full_name: "Changed Later" });
    const res = await pdf(ctx.token, id);
    const number = (await db.Contract.findByPk(id)).reference_no;
    expect(res.headers["content-disposition"]).toMatch(new RegExp(`filename="${number}\\.pdf"`));
    const text = await allText(res.body);
    expect(text).toContain("Frozen Name");
    expect(text).not.toContain("Changed Later");
    expect(text).toContain("Not final");
  });

  it("downloads the stored final PDF of a COMPLETED contract", async () => {
    const e = await newEmp(ctx);
    const id = (await send(ctx, [e.id])).body.data.results[0].contractId;
    const finalBytes = Buffer.concat([SAMPLE_PDF]);
    const p = `${ctx.employer.id}/signed/${crypto.randomUUID()}.pdf`;
    await storage.savePrivate(finalBytes, p);
    await db.Contract.update(
      { status: "COMPLETED", signed_pdf_path: p, signed_pdf_sha256: crypto.createHash("sha256").update(finalBytes).digest("hex") },
      { where: { id } }
    );
    const res = await pdf(ctx.token, id);
    expect(res.status).toBe(200);
    expect(res.body.equals(finalBytes)).toBe(true);
  });

  it("500 and a log line when the stored document no longer matches its hash", async () => {
    const other = await setupCompany("Tamper Co");
    await attachSampleFile(other.document);
    fs.appendFileSync(path.join(STORAGE_DIR, other.document.file_path), "x");
    const e = await newEmp(other);
    const id = (await draftsFor(other, [e.id])).body.data.results[0].contractId;
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await api.get(`/contracts/${id}/pdf`, other.token);
    expect(res.status).toBe(500);
    expect(res.body).toEqual(errorBody("INTERNAL_ERROR"));
    expect(spy.mock.calls.flat().join(" ")).toMatch(/contract file integrity check failed/);
    spy.mockRestore();
  });
});

describe("permissions", () => {
  let ctx;
  let id;

  beforeAll(async () => {
    ctx = await setupCompany();
    await attachSampleFile(ctx.document);
    const e = await newEmp(ctx);
    id = (await draftsFor(ctx, [e.id])).body.data.results[0].contractId;
  });

  const calls = { list: (t) => list(t), stats: (t) => stats(t), detail: (t) => detail(t, id), pdf: (t) => api.get(`/contracts/${id}/pdf`, t) };

  it("401 without a token", async () => {
    expect((await list(undefined)).status).toBe(401);
  });

  it.each(Object.keys(calls))("%s: 403 without contract:read, allowed with it", async (name) => {
    const denied = await hrLogin(ctx.employer, { can_create: true, can_update: true, can_delete: true });
    const res = await calls[name](denied.token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    const allowed = await hrLogin(ctx.employer, { can_read: true });
    expect((await calls[name](allowed.token)).status).toBe(200);
  });

  it("403 for the employee and the staffing company", async () => {
    const { user: e } = await createEmployee(ctx.employer);
    const { user: s } = await createStaffingCompany(ctx.employer);
    for (const user of [e, s]) {
      const token = await h.loginAs(user.email);
      for (const call of Object.values(calls)) expect((await call(token)).status).toBe(403);
    }
  });
});
