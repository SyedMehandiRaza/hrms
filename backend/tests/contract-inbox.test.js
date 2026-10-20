const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-contract-inbox-"));
process.env.CONTRACT_STORAGE_DIR = STORAGE_DIR;

const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");
const { openPdf, pageText } = require("./helpers/pdf");
const storage = require("../src/services/storage.service");

const { db, api, errorBody, createCompany, createEmployee, createStaffingCompany, createLogin, loginAs } = h;
const { setupCompany, createContracts, draftsFor, terms, attachSampleFile, SAMPLE_PDF } = f;

// Signer inbox: My Contracts list and detail, VIEWED on first open, downloads
// (ticket contract-studio#09; plan decisions 26–28, 39).

afterAll(async () => {
  await db.sequelize.close();
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

const bytesOf = (req) =>
  req.buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  });
const myList = (token, query) => api.get("/my/contracts", token, { query });
const myOne = (token, id) => api.get(`/my/contracts/${id}`, token);
const myDoc = (token, id) => bytesOf(api.get(`/my/contracts/${id}/document`, token));
const myPdf = (token, id) => bytesOf(api.get(`/my/contracts/${id}/pdf`, token));
const send = async (ctx, ids, overrides = {}) =>
  (await createContracts(ctx.token, { mode: "SEND", templateId: ctx.template.id, recipientIds: ids, ...terms(), ...overrides })).body.data.results.map((r) => r.contractId);
const sendStaffing = async (ctx, ids) =>
  (await createContracts(ctx.token, { mode: "SEND", templateId: ctx.staffingTemplate.id, recipientIds: ids, ...terms() })).body.data.results.map((r) => r.contractId);
const signer = async (ctx, overrides = {}, opts) => {
  const { user, employee } = await createEmployee(ctx.employer, { full_name: `Emp ${h.short()}`, ...overrides }, opts);
  return { user, employee, token: await loginAs(user.email) };
};
const ids = (res) => res.body.data.items.map((c) => c.id);

describe("list", () => {
  let ctx;
  let me;
  let mine;

  beforeAll(async () => {
    ctx = await setupCompany();
    await attachSampleFile(ctx.document);
    me = await signer(ctx, { full_name: "Sara Khan" });
    const other = await signer(ctx);
    const t2 = await f.makeTemplate(ctx.employer, { document: ctx.document, type: ctx.staffType, name: "Second" });
    const t3 = await f.makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: "Third", code: "THIRD" }), name: "Third" });
    const [older] = await send(ctx, [me.employee.id], { name: "Older Pending" });
    await db.Contract.update({ sent_at: new Date(Date.now() - 86400000) }, { where: { id: older } });
    const [newer] = await send(ctx, [me.employee.id], { name: "Newer Pending", templateId: t2.id });
    const [done] = await send(ctx, [me.employee.id], { name: "Finished One", templateId: t3.id });
    await db.Contract.update({ status: "COMPLETED" }, { where: { id: done } });
    const [draft] = (await draftsFor(ctx, [me.employee.id], { name: "Hidden Draft" })).body.data.results.map((r) => r.contractId);
    const [others] = await send(ctx, [other.employee.id]);
    mine = { older, newer, done, draft, others };
  });

  it("shows only the caller's own non-draft contracts: pending first (oldest sent first), then the rest", async () => {
    const res = await myList(me.token);
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([mine.older, mine.newer, mine.done]);
    expect(res.body.data).toMatchObject({ total: 3, page: 1 });
    expect(res.body.data.items[0]).toMatchObject({ name: "Older Pending", status: "SENT", contract_type: { name: "Employment Contract" }, field_count: 2 });
  });

  it("searches by name or number and paginates", async () => {
    expect(ids(await myList(me.token, { q: "finished" }))).toEqual([mine.done]);
    const number = (await db.Contract.findByPk(mine.newer)).reference_no;
    expect(ids(await myList(me.token, { q: number }))).toEqual([mine.newer]);
    expect(ids(await myList(me.token, { limit: 2, page: 2 }))).toEqual([mine.done]);
  });

  it("works for a GENERAL_EMPLOYEE with no role", async () => {
    const g = await signer(ctx, {}, { accessLevel: "GENERAL_EMPLOYEE" });
    const [id] = await send(ctx, [g.employee.id]);
    expect(ids(await myList(g.token))).toEqual([id]);
  });

  it("shows the owner's own contracts in My Requests and a sub-admin's own with no role", async () => {
    const { employee: ownerEmp } = await (async () => {
      const e = await db.Employee.create({ user_id: ctx.owner.id, employer_id: ctx.employer.id, employee_code: `E-${h.short()}`, country_emp_id: `O${h.short()}`, full_name: "Owner Person" });
      return { employee: e };
    })();
    const [ownerContract] = await send(ctx, [ownerEmp.id]);
    expect(ids(await myList(ctx.token))).toEqual([ownerContract]);

    const { user: sub } = await createLogin(ctx.employer, "SUB_ADMIN");
    const subEmp = await db.Employee.create({ user_id: sub.id, employer_id: ctx.employer.id, employee_code: `E-${h.short()}`, country_emp_id: `S${h.short()}`, full_name: "Sub Admin" });
    const [subContract] = await send(ctx, [subEmp.id]);
    expect(ids(await myList(await loginAs(sub.email)))).toEqual([subContract]);
  });

  it("gives an admin without an employee record an empty list", async () => {
    const other = await createCompany();
    const res = await myList(await h.ownerToken(other));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("shows the staffing company only its own Staffing Company contracts, none of its supplied employees'", async () => {
    const { user, company: s } = await createStaffingCompany(ctx.employer);
    const supplied = await signer(ctx, { staffing_company_id: s.id });
    const [ownContract] = await sendStaffing(ctx, [s.id]);
    await send(ctx, [supplied.employee.id]);
    expect(ids(await myList(await loginAs(user.email)))).toEqual([ownContract]);
  });

  it("401 without a token", async () => {
    expect((await myList(undefined)).status).toBe(401);
  });
});

describe("detail, VIEWED and downloads", () => {
  let ctx;
  let me;

  beforeAll(async () => {
    ctx = await setupCompany();
    await attachSampleFile(ctx.document);
    me = await signer(ctx, { full_name: "Frozen Name" });
  });

  it("marks a SENT contract VIEWED on the signer's first open, with time, IP and user agent", async () => {
    const [id] = await send(ctx, [me.employee.id]);
    const res = await api.get(`/my/contracts/${id}`, me.token).set("User-Agent", "Mozilla/5.0 (Inbox Test)");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, status: "VIEWED" });
    const c = await db.Contract.findByPk(id, { include: ["contractRecipients"] });
    expect(c.status).toBe("VIEWED");
    expect(c.viewed_at).toBeInstanceOf(Date);
    expect(c.contractRecipients[0]).toMatchObject({ status: "VIEWED" });
    expect(c.contractRecipients[0].viewed_at).toBeInstanceOf(Date);
    const viewed = await db.ContractActivity.findAll({ where: { contract_id: id, action: "VIEWED" } });
    expect(viewed).toHaveLength(1);
    expect(viewed[0].actor_user_id).toBe(me.user.id);
    expect(viewed[0].meta.user_agent).toBe("Mozilla/5.0 (Inbox Test)");
    expect(viewed[0].meta.ip).toEqual(expect.any(String));
  });

  it("changes nothing on later opens or when HR opens it", async () => {
    const [id] = await send(ctx, [me.employee.id], { templateId: (await f.makeTemplate(ctx.employer, { document: ctx.document, type: ctx.staffType })).id });
    await h.api.get(`/contracts/${id}`, ctx.token);
    expect((await db.Contract.findByPk(id)).status).toBe("SENT");
    await myOne(me.token, id);
    const first = await db.Contract.findByPk(id);
    await myOne(me.token, id);
    expect((await db.Contract.findByPk(id)).viewed_at).toEqual(first.viewed_at);
    expect(await db.ContractActivity.count({ where: { contract_id: id, action: "VIEWED" } })).toBe(1);
  });

  it("logs one VIEWED activity when the signer opens it in two tabs at once", async () => {
    const t = await f.makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: `Tabs ${h.short()}`, code: `TB${h.short()}` }) });
    const [id] = await send(ctx, [me.employee.id], { templateId: t.id });
    await Promise.all([myOne(me.token, id), myOne(me.token, id), myOne(me.token, id)]);
    expect(await db.ContractActivity.count({ where: { contract_id: id, action: "VIEWED" } })).toBe(1);
  });

  it("returns fields and values but never the activity log or other recipients", async () => {
    const t = await f.makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: `D ${h.short()}`, code: `D${h.short()}` }) });
    const [id] = await send(ctx, [me.employee.id], { templateId: t.id });
    const res = await myOne(me.token, id);
    expect(res.body.data).not.toHaveProperty("activity");
    expect(res.body.data.fields.map((x) => x.field_type).sort()).toEqual(["SIGNATURE"]);
    expect(Object.keys(res.body.data)).not.toContain("recipients");
  });

  it("shows a past-due contract as EXPIRED with one EXPIRED activity", async () => {
    const t = await f.makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: `E ${h.short()}`, code: `E${h.short()}` }) });
    const [id] = await send(ctx, [me.employee.id], { templateId: t.id });
    await db.Contract.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id } });
    expect((await myList(me.token)).body.data.items.find((c) => c.id === id).status).toBe("EXPIRED");
    expect((await myOne(me.token, id)).body.data.status).toBe("EXPIRED");
    expect(await db.ContractActivity.count({ where: { contract_id: id, action: "EXPIRED" } })).toBe(1);
  });

  it("expires a past-due contract when only its document is opened", async () => {
    const t = await f.makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: `D ${h.short()}`, code: `D${h.short()}` }) });
    const [id] = await send(ctx, [me.employee.id], { templateId: t.id });
    await db.Contract.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id } });
    expect((await myDoc(me.token, id)).status).toBe(200);
    expect((await db.Contract.findByPk(id)).status).toBe("EXPIRED");
    expect(await db.ContractActivity.count({ where: { contract_id: id, action: "EXPIRED" } })).toBe(1);
  });

  it("serves the original document bytes inline, without values or watermark", async () => {
    const [id] = await send(ctx, [me.employee.id], { templateId: (await f.makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: `O ${h.short()}`, code: `O${h.short()}` }) })).id });
    const res = await myDoc(me.token, id);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/^inline/);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.equals(SAMPLE_PDF)).toBe(true);
  });

  it("downloads a preview with frozen values and 'Not final', as an attachment named after the number", async () => {
    const [id] = await send(ctx, [me.employee.id], { templateId: (await f.makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: `P ${h.short()}`, code: `P${h.short()}` }), fields: [f.mergeField("EMPLOYEE", "employee_name"), f.sig()] })).id });
    await me.employee.update({ full_name: "Changed Later" });
    const res = await myPdf(me.token, id);
    const number = (await db.Contract.findByPk(id)).reference_no;
    expect(res.headers["content-disposition"]).toMatch(new RegExp(`^attachment; filename="${number}\\.pdf"`));
    expect(res.headers["cache-control"]).toBe("no-store");
    const doc = await openPdf(res.body);
    const text = (await pageText(doc, 1)).map((i) => i.str);
    expect(text).toContain("Frozen Name");
    expect(text).toContain("Not final");
    await me.employee.update({ full_name: "Frozen Name" });
  });

  it("downloads the stored final PDF of a COMPLETED contract; a tampered one → 500 and a log line", async () => {
    const [id] = await send(ctx, [me.employee.id], { templateId: (await f.makeTemplate(ctx.employer, { document: ctx.document, type: await db.ContractType.create({ employer_id: ctx.employer.id, name: `C ${h.short()}`, code: `C${h.short()}` }) })).id });
    const p = `${ctx.employer.id}/signed/${crypto.randomUUID()}.pdf`;
    await storage.savePrivate(SAMPLE_PDF, p);
    await db.Contract.update(
      { status: "COMPLETED", signed_pdf_path: p, signed_pdf_sha256: crypto.createHash("sha256").update(SAMPLE_PDF).digest("hex") },
      { where: { id } }
    );
    const ok = await myPdf(me.token, id);
    expect(ok.body.equals(SAMPLE_PDF)).toBe(true);
    expect(crypto.createHash("sha256").update(ok.body).digest("hex")).toBe((await db.Contract.findByPk(id)).signed_pdf_sha256);
    fs.appendFileSync(path.join(STORAGE_DIR, p), "x");
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const bad = await api.get(`/my/contracts/${id}/pdf`, me.token);
    expect(bad.status).toBe(500);
    expect(bad.body).toEqual(errorBody("INTERNAL_ERROR"));
    expect(spy.mock.calls.flat().join(" ")).toMatch(/contract file integrity check failed/);
    spy.mockRestore();
  });
});

describe("wrong callers get 404 and change nothing", () => {
  let ctx;
  let owner;
  let contractId;
  let staffingContract;
  let staffingUser;
  let supplied;

  beforeAll(async () => {
    ctx = await setupCompany();
    await attachSampleFile(ctx.document);
    owner = await signer(ctx);
    [contractId] = await send(ctx, [owner.employee.id]);
    const s = await createStaffingCompany(ctx.employer);
    staffingUser = s.user;
    supplied = await signer(ctx, { staffing_company_id: s.company.id });
    [staffingContract] = await sendStaffing(ctx, [s.company.id]);
  });

  const expectHidden = async (token, id) => {
    for (const res of [await myOne(token, id), await api.get(`/my/contracts/${id}/document`, token), await api.get(`/my/contracts/${id}/pdf`, token)]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
  };

  it("another employee", async () => {
    await expectHidden((await signer(ctx)).token, contractId);
  });

  it("the employee asking for a staffing contract", async () => {
    await expectHidden(owner.token, staffingContract);
  });

  it("the staffing company asking for its supplied employee's contract", async () => {
    const [suppliedContract] = await send(ctx, [supplied.employee.id]);
    await expectHidden(await loginAs(staffingUser.email), suppliedContract);
  });

  it("HR with contract:read and the owner, when it isn't addressed to them", async () => {
    await expectHidden((await h.hrLogin(ctx.employer, h.ALL_FLAGS)).token, contractId);
    await expectHidden(ctx.token, contractId);
  });

  it("a person whose account in the contract's company ended and who now logs in to another company", async () => {
    const mover = await signer(ctx);
    const [id] = await send(ctx, [mover.employee.id], { templateId: (await f.makeTemplate(ctx.employer, { document: ctx.document, type: ctx.staffType })).id });
    await db.HrmsAccount.update({ status: "INACTIVE" }, { where: { user_id: mover.user.id, employer_id: ctx.employer.id } });
    const other = await createCompany();
    await db.HrmsAccount.create({ user_id: mover.user.id, employer_id: other.employer.id, access_level: "EMPLOYEE", password_setup_required: false });
    await expectHidden(await loginAs(mover.user.email), id);
  });

  it("a draft, a malformed id, or an admin with no employee record", async () => {
    const [draft] = (await draftsFor(ctx, [owner.employee.id])).body.data.results.map((r) => r.contractId);
    await expectHidden(owner.token, draft);
    await expectHidden(owner.token, "not-an-id");
    await expectHidden(await h.ownerToken(await createCompany()), contractId);
  });

  it("nothing changes for those calls (still SENT, no VIEWED activity)", async () => {
    expect((await db.Contract.findByPk(contractId)).status).toBe("SENT");
    expect(await db.ContractActivity.count({ where: { contract_id: contractId, action: "VIEWED" } })).toBe(0);
  });
});
