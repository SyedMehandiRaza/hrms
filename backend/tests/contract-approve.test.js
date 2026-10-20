const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-contract-approve-"));
process.env.CONTRACT_STORAGE_DIR = STORAGE_DIR;

const { PDFDocument } = require("pdf-lib");
const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");
const { openPdf, pageText } = require("./helpers/pdf");
const pdfService = require("../src/services/contractPdf.service");

const { db, api, errorBody, validationBody, createEmployee, createStaffingCompany, loginAs, hrLogin, createCompany } = h;
const { setupCompany, createContracts, terms, attachSampleFile } = f;

// Approve and revoke (ticket contract-studio#12; plan decisions 33–34, 37, 38; ADR 0007).

afterAll(async () => {
  await db.sequelize.close();
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

const REASON = "Terms changed after negotiation.";
const approve = (token, id) => api.post(`/contracts/${id}/approve`, token, {});
const revoke = (token, id, body, lang) => api.post(`/contracts/${id}/revoke`, token, body, { lang });
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const signedFiles = (employerId) => {
  const dir = path.join(STORAGE_DIR, employerId, "signed");
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

let ctx;
beforeAll(async () => {
  ctx = await setupCompany();
  await attachSampleFile(ctx.document);
});

// A SENT contract for a fresh employee (own type), optionally signed.
const fresh = async ({ submitted = false, employee } = {}) => {
  const emp = employee ? { employee, user: await db.User.findByPk(employee.user_id) } : await createEmployee(ctx.employer, { full_name: "Sara Khan" });
  const type = await db.ContractType.create({ employer_id: ctx.employer.id, name: `T ${h.short()}`, code: `T${h.short()}` });
  await ctx.template.update({ contract_type_id: type.id });
  const res = await createContracts(ctx.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: [emp.employee.id], ...terms() });
  const id = res.body.data.results[0].contractId;
  if (submitted) {
    const sigId = (await db.ContractField.findAll({ where: { contract_id: id } })).find((x) => x.field_type === "SIGNATURE").id;
    const token = await loginAs(emp.user.email);
    const s = await h.withAuth(h.request(h.app).post(`/api/my/contracts/${id}/submit`), token).send({ consent: true, fields: { [sigId]: { type: "TYPED", text: "Sara Khan" } } });
    expect(s.status).toBe(200);
  }
  return { id, ...emp };
};

describe("approve", () => {
  it("completes a SUBMITTED contract: approver and times, final PDF stored privately with its SHA-256, COMPLETED activity", async () => {
    const c0 = await fresh({ submitted: true });
    const res = await approve(ctx.token, c0.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: c0.id, status: "COMPLETED" });
    const c = await db.Contract.findByPk(c0.id);
    expect(c).toMatchObject({ status: "COMPLETED", approved_by: ctx.owner.id });
    expect(c.approved_at).toBeInstanceOf(Date);
    expect(c.completed_at).toBeInstanceOf(Date);
    expect(c.signed_pdf_path).toMatch(new RegExp(`^${ctx.employer.id}/signed/[0-9a-f-]{36}\\.pdf$`));
    const bytes = fs.readFileSync(path.join(STORAGE_DIR, c.signed_pdf_path));
    expect(sha(bytes)).toBe(c.signed_pdf_sha256);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(4);
    const doc = await openPdf(bytes);
    const cert = (await pageText(doc, 4)).map((i) => i.str).join("\n");
    expect(cert).toContain("Certificate of completion");
    expect(cert).toContain(c.reference_no);
    expect(cert).toContain("Owner Person");
    const act = await db.ContractActivity.findAll({ where: { contract_id: c0.id, action: "COMPLETED" } });
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ actor_user_id: ctx.owner.id, meta: { signed_pdf_sha256: c.signed_pdf_sha256 } });
    // HR download gives the stored final PDF.
    const dl = await api.get(`/contracts/${c0.id}/pdf`, ctx.token).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on("data", (x) => chunks.push(x));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(dl.body.equals(bytes)).toBe(true);
  });

  it("500 and nothing stored when PDF generation fails", async () => {
    const c0 = await fresh({ submitted: true });
    const spy = jest.spyOn(pdfService, "render").mockRejectedValueOnce(new pdfService.ContractPdfError("SOURCE_INVALID", "boom"));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const before = signedFiles(ctx.employer.id).length;
    const res = await approve(ctx.token, c0.id);
    spy.mockRestore();
    log.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual(errorBody("INTERNAL_ERROR"));
    const c = await db.Contract.findByPk(c0.id);
    expect(c).toMatchObject({ status: "SUBMITTED", signed_pdf_path: null, approved_by: null });
    expect(signedFiles(ctx.employer.id).length).toBe(before);
  });

  it("500, still SUBMITTED and no PDF file left behind when saving fails after the file was written", async () => {
    const c0 = await fresh({ submitted: true });
    const before = signedFiles(ctx.employer.id).length;
    const spy = jest.spyOn(db.ContractActivity, "create").mockRejectedValueOnce(new Error("db down"));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await approve(ctx.token, c0.id);
    spy.mockRestore();
    log.mockRestore();
    expect(res.status).toBe(500);
    expect((await db.Contract.findByPk(c0.id)).status).toBe("SUBMITTED");
    expect(signedFiles(ctx.employer.id).length).toBe(before);
  });

  it("lets exactly one of two approvals win, leaving one final PDF", async () => {
    const c0 = await fresh({ submitted: true });
    const before = signedFiles(ctx.employer.id).length;
    const [a, b] = await Promise.all([approve(ctx.token, c0.id), approve(ctx.token, c0.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((a.status === 409 ? a : b).body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
    expect(signedFiles(ctx.employer.id).length).toBe(before + 1);
  });

  it("refuses to let the signer approve their own contract → 403 CONTRACT_SELF_APPROVAL (the owner too)", async () => {
    const ownerEmp = await db.Employee.create({ user_id: ctx.owner.id, employer_id: ctx.employer.id, employee_code: `E-${h.short()}`, country_emp_id: `O${h.short()}`, full_name: "Owner Person" });
    const own = await fresh({ employee: ownerEmp, submitted: true });
    const res = await approve(ctx.token, own.id);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("CONTRACT_SELF_APPROVAL"));

    const sub = await hrLogin(ctx.employer, { can_update: true });
    const subEmp = await db.Employee.create({ user_id: sub.user.id, employer_id: ctx.employer.id, employee_code: `E-${h.short()}`, country_emp_id: `S${h.short()}`, full_name: "Sub" });
    const subOwn = await fresh({ employee: subEmp, submitted: true });
    expect((await approve(sub.token, subOwn.id)).body).toEqual(errorBody("CONTRACT_SELF_APPROVAL"));
    // Anyone else may approve it.
    expect((await approve(ctx.token, subOwn.id)).status).toBe(200);
  });

  it("checks state before self-approval: a revoked contract of their own → 409 CONTRACT_STATUS_INVALID", async () => {
    const ownerEmp = await db.Employee.findOne({ where: { user_id: ctx.owner.id, employer_id: ctx.employer.id } });
    const own = await fresh({ employee: ownerEmp });
    await db.Contract.update({ status: "REVOKED" }, { where: { id: own.id } });
    expect((await approve(ctx.token, own.id)).body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
  });

  it.each(["SENT", "VIEWED", "REJECTED", "EXPIRED", "REVOKED", "COMPLETED"])("refuses to approve a %s contract → 409 CONTRACT_STATUS_INVALID", async (status) => {
    const c0 = await fresh();
    await db.Contract.update({ status }, { where: { id: c0.id } });
    const res = await approve(ctx.token, c0.id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
  });

  it("refuses when the signer has become inactive → 409 CONTRACT_RECIPIENT_INACTIVE", async () => {
    const c0 = await fresh({ submitted: true });
    await c0.employee.update({ employment_status: "EXITED" });
    const res = await approve(ctx.token, c0.id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_RECIPIENT_INACTIVE"));
  });
});

describe("revoke", () => {
  it.each(["SENT", "VIEWED", "SUBMITTED"])("revokes a %s contract with reason, time and revoker, and a REVOKED activity", async (status) => {
    const c0 = await fresh();
    await db.Contract.update({ status }, { where: { id: c0.id } });
    const res = await revoke(ctx.token, c0.id, { reason: `  ${REASON} ` });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "REVOKED", revoke_reason: REASON });
    const c = await db.Contract.findByPk(c0.id);
    expect(c).toMatchObject({ status: "REVOKED", revoke_reason: REASON, revoked_by: ctx.owner.id });
    expect(c.revoked_at).toBeInstanceOf(Date);
    const acts = await db.ContractActivity.findAll({ where: { contract_id: c0.id, action: "REVOKED" } });
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ actor_user_id: ctx.owner.id, meta: { reason: REASON } });
  });

  it.each(["DRAFT", "COMPLETED", "REJECTED", "EXPIRED", "REVOKED"])("refuses to revoke a %s contract → 409 CONTRACT_STATUS_INVALID", async (status) => {
    const c0 = await fresh();
    await db.Contract.update({ status, ...(status === "DRAFT" ? { reference_no: null } : {}) }, { where: { id: c0.id } });
    const res = await revoke(ctx.token, c0.id, { reason: REASON });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
  });

  it("refuses a SENT contract past its sign-by time (before the job runs) → 409, and it is now EXPIRED", async () => {
    const c0 = await fresh();
    await db.Contract.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id: c0.id } });
    const res = await revoke(ctx.token, c0.id, { reason: REASON });
    expect(res.body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
    expect((await db.Contract.findByPk(c0.id)).status).toBe("EXPIRED");
  });

  it.each([
    [{}, "contractReasonRequired"],
    [{ reason: "r".repeat(9) }, "contractReasonMin"],
    [{ reason: "r".repeat(501) }, "contractReasonMax"],
    [{ reason: "Withdrawn 😀 now please" }, "noEmojis"],
  ])("400 for %j", async (body, key) => {
    const c0 = await fresh();
    const res = await revoke(ctx.token, c0.id, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ reason: key }));
  });

  it("lets HR send a new contract of the same type to that recipient after revoking", async () => {
    const c0 = await fresh();
    await revoke(ctx.token, c0.id, { reason: REASON });
    const res = await createContracts(ctx.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: [c0.employee.id], ...terms() });
    expect(res.body.data.results[0].result).toBe("SENT");
  });
});

describe("permissions and tenancy", () => {
  it("403 without contract:update for approve and revoke; allowed with it", async () => {
    const a = await fresh({ submitted: true });
    const b = await fresh();
    const denied = await hrLogin(ctx.employer, { can_read: true, can_create: true, can_delete: true });
    expect((await approve(denied.token, a.id)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await revoke(denied.token, b.id, { reason: REASON })).body).toEqual(errorBody("FORBIDDEN"));
    const allowed = await hrLogin(ctx.employer, { can_update: true });
    expect((await approve(allowed.token, a.id)).status).toBe(200);
    expect((await revoke(allowed.token, b.id, { reason: REASON })).status).toBe(200);
  });

  it("403 for the employee and the staffing company", async () => {
    const a = await fresh({ submitted: true });
    const { user: s } = await createStaffingCompany(ctx.employer);
    for (const token of [await loginAs(a.user.email), await loginAs(s.email)]) {
      expect((await approve(token, a.id)).status).toBe(403);
      expect((await revoke(token, a.id, { reason: REASON })).status).toBe(403);
    }
  });

  it("404 for another company's contract", async () => {
    const a = await fresh({ submitted: true });
    const other = await createCompany();
    const token = await h.ownerToken(other);
    for (const res of [await approve(token, a.id), await revoke(token, a.id, { reason: REASON })]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});
