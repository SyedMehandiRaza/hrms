const crypto = require("crypto");
const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");
const { endOfDayUtc } = require("../src/utils/companyTime");
const { valuesSha256 } = require("../src/services/contractMerge.service");

const { db, api, errorBody, validationBody, createCompany, hrLogin, createEmployee, createStaffingCompany, createProject, assignProject } = h;
const { setupCompany, createContracts, draftsFor, terms, today, inDays, makeTemplate, sig, mergeField, TZ } = f;

// Send contracts, single and bulk (ticket contract-studio#08; plan decisions 23–25, 35, 41).

afterAll(() => db.sequelize.close());

const send = (ctx, recipientIds, overrides = {}, token = ctx.token, opts) =>
  createContracts(token, { mode: "SEND", templateId: ctx.template.id, recipientIds, ...terms(), ...overrides }, opts);
const sendDraft = (token, id, opts) => api.post(`/contracts/${id}/send`, token, {}, opts);
// A per-recipient result carries code + message (no success flag).
const rowError = (code, lang, params) => ({ code, message: errorBody(code, lang, params).message });
const num = (ctx, n) => `CON-${ctx.year}-${String(n).padStart(4, "0")}`;
const contractOf = (id) => db.Contract.findByPk(id, { include: ["contractFields", "contractRecipients", "contractActivities"] });
const newEmployee = async (ctx, overrides = {}, opts) => (await createEmployee(ctx.employer, { full_name: `Emp ${h.short()}`, ...overrides }, opts)).employee;

describe("send from the wizard", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupCompany();
  });

  it("sends to 3 valid employees: numbered, values frozen, expiry at the end of the sign-by day, SENT activity", async () => {
    const emps = [await newEmployee(ctx, { full_name: "Sara Khan" }), await newEmployee(ctx, { full_name: "Omar Farooq" }), await newEmployee(ctx, { full_name: "Ali Hassan" })];
    const res = await send(ctx, emps.map((e) => e.id), { sign_by: inDays(5) });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ sent: 3, drafts: 0, failed: 0 });
    expect(res.body.data.results.map((r) => r.result)).toEqual(["SENT", "SENT", "SENT"]);
    const numbers = [];
    for (const [i, r] of res.body.data.results.entries()) {
      const c = await contractOf(r.contractId);
      numbers.push(c.reference_no);
      expect(c.status).toBe("SENT");
      expect(c.sent_at).toBeInstanceOf(Date);
      expect(c.expires_at.toISOString()).toBe(endOfDayUtc(inDays(5), TZ).toISOString());
      const name = c.contractFields.find((x) => x.db_column === "employee_name");
      expect(name.value).toBe(emps[i].full_name);
      expect(c.values_sha256).toBe(valuesSha256(c.contractFields.filter((x) => x.field_type === "DB_COLUMN").map((x) => ({ id: x.id, field_type: x.field_type, value: x.value }))));
      expect(c.contractRecipients[0]).toMatchObject({ status: "SENT" });
      const sent = c.contractActivities.find((a) => a.action === "SENT");
      expect(sent).toMatchObject({ actor_user_id: ctx.owner.id });
      expect(sent.meta).toMatchObject({ number: c.reference_no, values_sha256: c.values_sha256, expires_at: c.expires_at.toISOString() });
    }
    expect(numbers).toEqual([num(ctx, 1), num(ctx, 2), num(ctx, 3)]);
  });

  it("freezes contract_no and sent_date merge values and sets the employee's main project", async () => {
    const template = await makeTemplate(ctx.employer, {
      document: ctx.document,
      type: ctx.type,
      fields: [mergeField("CONTRACT", "contract_no"), mergeField("CONTRACT", "sent_date"), mergeField("EMPLOYEE", "project"), sig()],
    });
    const e = await newEmployee(ctx);
    const project = await createProject(ctx.employer, { project_name: "King Salman Park" });
    await assignProject(ctx.employer, e, project, { main_project: true, main_project_date_start: "2026-01-01" });
    const res = await send(ctx, [e.id], { templateId: template.id });
    const c = await contractOf(res.body.data.results[0].contractId);
    const values = Object.fromEntries(c.contractFields.map((x) => [x.db_column, x.value]));
    const [y, m, d] = today().split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    expect(values.contract_no).toBe(c.reference_no);
    expect(values.sent_date).toBe(`${d} ${months[Number(m) - 1]} ${y}`);
    expect(values.project).toBe("King Salman Park");
    expect(c.project_id).toBe(project.id);
  });

  it("keeps a recipient with a missing required value as DRAFT, still sending the others", async () => {
    const template = await makeTemplate(ctx.employer, { document: ctx.document, type: ctx.type, fields: [mergeField("EMPLOYEE", "designation", { label: "Designation" }), sig()] });
    const desig = await db.Designation.create({
      employer_id: ctx.employer.id,
      department_id: (await db.Department.create({ employer_id: ctx.employer.id, name: `D ${h.short()}`, code: `D${h.short()}` })).id,
      name: "Engineer",
    });
    const ok = await newEmployee(ctx, { designation_id: desig.id });
    const bare = await newEmployee(ctx, { full_name: "No Designation" });
    const res = await send(ctx, [ok.id, bare.id], { templateId: template.id });
    expect(res.body.data).toMatchObject({ sent: 1, drafts: 1 });
    const blocked = res.body.data.results[1];
    expect(blocked).toEqual({
      contractId: blocked.contractId,
      recipientName: "No Designation",
      result: "DRAFT",
      ...rowError("CONTRACT_FIELD_MISSING", "en", { fields: "Designation" }),
    });
    const c = await contractOf(blocked.contractId);
    expect(c.status).toBe("DRAFT");
    expect(c.reference_no).toBeNull();
    expect(c.meta.block).toEqual({ code: "CONTRACT_FIELD_MISSING", params: { fields: "Designation" } });
  });

  it("keeps a recipient with an active contract of the type as DRAFT, naming that contract", async () => {
    const e = await newEmployee(ctx);
    const first = (await send(ctx, [e.id])).body.data.results[0];
    const firstNo = (await db.Contract.findByPk(first.contractId)).reference_no;
    for (const status of ["SENT", "VIEWED", "SUBMITTED"]) {
      await db.Contract.update({ status }, { where: { id: first.contractId } });
      const res = await send(ctx, [e.id]);
      expect(res.body.data.results[0]).toMatchObject({ result: "DRAFT", ...rowError("CONTRACT_ACTIVE_EXISTS", "en", { number: firstNo }) });
    }
  });

  it("sends when the recipient only has a COMPLETED contract of the type", async () => {
    const e = await newEmployee(ctx);
    const first = (await send(ctx, [e.id])).body.data.results[0];
    await db.Contract.update({ status: "COMPLETED" }, { where: { id: first.contractId } });
    expect((await send(ctx, [e.id])).body.data.results[0].result).toBe("SENT");
  });

  it.each([
    ["exited", { employment_status: "EXITED" }, {}],
    ["with an ended account", {}, { accountStatus: "INACTIVE" }],
    ["without an account", {}, { account: false }],
  ])("keeps an employee %s as DRAFT / CONTRACT_RECIPIENT_INACTIVE", async (_, overrides, opts) => {
    const e = await newEmployee(ctx, overrides, opts);
    const res = await send(ctx, [e.id]);
    expect(res.body.data.results[0]).toMatchObject({ result: "DRAFT", ...rowError("CONTRACT_RECIPIENT_INACTIVE") });
  });

  it("keeps a deleted employee as DRAFT / CONTRACT_RECIPIENT_INACTIVE", async () => {
    const e = await newEmployee(ctx);
    await e.destroy();
    expect((await send(ctx, [e.id])).body.data.results[0]).toMatchObject({ result: "DRAFT", code: "CONTRACT_RECIPIENT_INACTIVE" });
  });

  it.each([
    ["inactive", { status: "INACTIVE" }, {}],
    ["without a login", {}, { login: false }],
    ["whose login's account ended", {}, { accountStatus: "INACTIVE" }],
  ])("keeps a staffing company %s as DRAFT / CONTRACT_RECIPIENT_INACTIVE", async (_, overrides, opts) => {
    const { company: s } = await createStaffingCompany(ctx.employer, overrides, opts);
    const res = await send(ctx, [s.id], { templateId: ctx.staffingTemplate.id });
    expect(res.body.data.results[0]).toMatchObject({ result: "DRAFT", ...rowError("CONTRACT_RECIPIENT_INACTIVE") });
  });

  it("sends to an IN_NOTICE employee, a suspended account and an active staffing company", async () => {
    const notice = await newEmployee(ctx, { employment_status: "IN_NOTICE" });
    const suspended = await newEmployee(ctx, {}, { accountStatus: "SUSPENDED" });
    expect((await send(ctx, [notice.id, suspended.id])).body.data.sent).toBe(2);
    const { company: s } = await createStaffingCompany(ctx.employer);
    expect((await send(ctx, [s.id], { templateId: ctx.staffingTemplate.id })).body.data.results[0].result).toBe("SENT");
  });

  it("answers the per-recipient message in Arabic", async () => {
    const e = await newEmployee(ctx, { employment_status: "EXITED" });
    const res = await send(ctx, [e.id], {}, ctx.token, { lang: "ar" });
    expect(res.body.data.results[0]).toMatchObject({ code: "CONTRACT_RECIPIENT_INACTIVE", message: errorBody("CONTRACT_RECIPIENT_INACTIVE", "ar").message });
  });

  it("reports an unexpected per-recipient failure as FAILED and continues", async () => {
    const a = await newEmployee(ctx);
    const b = await newEmployee(ctx);
    const original = db.ContractRecipient.create.bind(db.ContractRecipient);
    let calls = 0;
    const spy = jest.spyOn(db.ContractRecipient, "create").mockImplementation((...args) => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return original(...args);
    });
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await send(ctx, [a.id, b.id]);
    spy.mockRestore();
    log.mockRestore();
    expect(res.status).toBe(201);
    expect(res.body.data.results[0]).toEqual({ contractId: null, recipientName: a.full_name, result: "FAILED", code: "INTERNAL_ERROR", message: errorBody("INTERNAL_ERROR").message });
    expect(res.body.data.results[1].result).toBe("SENT");
    expect(res.body.data).toMatchObject({ sent: 1, failed: 1 });
    expect(await db.ContractRecipient.count({ where: { employee_id: a.id } })).toBe(0);
  });

  it("404 and nothing created when a recipient id is unknown, another company's or of the other audience", async () => {
    const before = await db.Contract.count({ where: { employer_id: ctx.employer.id } });
    const e = await newEmployee(ctx);
    const { company: s } = await createStaffingCompany(ctx.employer);
    for (const bad of [crypto.randomUUID(), s.id, (await createEmployee((await createCompany()).employer)).employee.id]) {
      const res = await send(ctx, [e.id, bad]);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
    expect(await db.Contract.count({ where: { employer_id: ctx.employer.id } })).toBe(before);
  });

  it("sends one contract for a recipient id given twice", async () => {
    const e = await newEmployee(ctx);
    expect((await send(ctx, [e.id, e.id])).body.data.results).toHaveLength(1);
  });

  it("refuses a template without a contract type → 409 CONTRACT_TEMPLATE_INACTIVE", async () => {
    const untyped = await makeTemplate(ctx.employer, { document: ctx.document, type: null });
    const e = await newEmployee(ctx);
    for (const res of [await send(ctx, [e.id], { templateId: untyped.id }), await draftsFor(ctx, [e.id], { templateId: untyped.id })]) {
      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("CONTRACT_TEMPLATE_INACTIVE"));
    }
  });

  it("sends from a template whose contract type was deactivated", async () => {
    const type = await db.ContractType.create({ employer_id: ctx.employer.id, name: `Off ${h.short()}`, code: `OFF${h.short()}`, is_active: false });
    const template = await makeTemplate(ctx.employer, { document: ctx.document, type });
    const e = await newEmployee(ctx);
    expect((await send(ctx, [e.id], { templateId: template.id })).body.data.results[0].result).toBe("SENT");
  });

  it("sends from an ACTIVE template whose document was archived", async () => {
    const doc = await db.ContractDocument.create({ employer_id: ctx.employer.id, name: "Archived", page_count: 3, status: "ARCHIVED" });
    const template = await makeTemplate(ctx.employer, { document: doc, type: ctx.type });
    const e = await newEmployee(ctx);
    expect((await send(ctx, [e.id], { templateId: template.id })).body.data.results[0].result).toBe("SENT");
  });

  it("changes no employee, account or staffing-company row", async () => {
    const e = await newEmployee(ctx);
    const snap = async () => ({
      e: await db.Employee.findAll({ where: { employer_id: ctx.employer.id }, paranoid: false, raw: true }),
      a: await db.HrmsAccount.findAll({ where: { employer_id: ctx.employer.id }, paranoid: false, raw: true }),
      s: await db.StaffingCompany.findAll({ where: { employer_id: ctx.employer.id }, paranoid: false, raw: true }),
    });
    const before = await snap();
    await send(ctx, [e.id]);
    expect(await snap()).toEqual(before);
  });
});

describe("numbers and financial years", () => {
  it("never gives two contracts the same number, even when sends run at once", async () => {
    const ctx = await setupCompany();
    const emps = [];
    for (let i = 0; i < 8; i += 1) emps.push(await newEmployee(ctx));
    const drafts = (await draftsFor(ctx, emps.map((e) => e.id))).body.data.results.map((r) => r.contractId);
    const results = await Promise.all(drafts.map((id) => sendDraft(ctx.token, id)));
    expect(results.map((r) => r.status)).toEqual(drafts.map(() => 200));
    const numbers = (await db.Contract.findAll({ where: { id: drafts } })).map((c) => c.reference_no).sort();
    expect(numbers).toEqual(Array.from({ length: 8 }, (_, i) => num(ctx, i + 1)));
  });

  it("gives both of two first sends of a year different numbers", async () => {
    const ctx = await setupCompany();
    const [a, b] = [await newEmployee(ctx), await newEmployee(ctx)];
    const [d1, d2] = (await draftsFor(ctx, [a.id, b.id])).body.data.results.map((r) => r.contractId);
    expect(await db.NumberSequence.count({ where: { employer_id: ctx.employer.id, doc_type: "CONTRACT" } })).toBe(0);
    const [r1, r2] = await Promise.all([sendDraft(ctx.token, d1), sendDraft(ctx.token, d2)]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect([r1.body.data.number, r2.body.data.number].sort()).toEqual([num(ctx, 1), num(ctx, 2)]);
  });

  it("doesn't use up a number when a send is blocked", async () => {
    const ctx = await setupCompany();
    const exited = await newEmployee(ctx, { employment_status: "EXITED" });
    const ok = await newEmployee(ctx);
    await send(ctx, [exited.id]);
    const res = await send(ctx, [ok.id]);
    expect((await db.Contract.findByPk(res.body.data.results[0].contractId)).reference_no).toBe(num(ctx, 1));
  });

  it.each([
    ["no financial year", null],
    ["a PLANNED year", "PLANNED"],
    ["a CLOSING year", "CLOSING"],
    ["a CLOSED year", "CLOSED"],
  ])("409 CONTRACT_NO_OPEN_FY with %s, and no drafts created", async (_, status) => {
    const ctx = await setupCompany();
    if (status) await ctx.fy.update({ status });
    else await ctx.fy.destroy();
    const e = await newEmployee(ctx);
    const before = await db.Contract.count({ where: { employer_id: ctx.employer.id } });
    const res = await send(ctx, [e.id, (await newEmployee(ctx)).id]);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_NO_OPEN_FY"));
    expect(await db.Contract.count({ where: { employer_id: ctx.employer.id } })).toBe(before);
  });

  it("409 CONTRACT_NO_OPEN_FY when the open year doesn't include today", async () => {
    const ctx = await setupCompany();
    await ctx.fy.update({ start_date: `${ctx.year + 1}-01-01`, end_date: `${ctx.year + 1}-12-31`, year_key: ctx.year + 1 });
    const res = await send(ctx, [(await newEmployee(ctx)).id]);
    expect(res.body).toEqual(errorBody("CONTRACT_NO_OPEN_FY"));
  });
});

describe("send a draft", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupCompany();
  });

  const draftOf = async (e, overrides) => (await draftsFor(ctx, [e.id], overrides)).body.data.results[0].contractId;

  it("sends an existing draft with the next number, freezing current values", async () => {
    const e = await newEmployee(ctx, { full_name: "Before Rename" });
    const id = await draftOf(e);
    await e.update({ full_name: "After Rename" });
    const res = await sendDraft(ctx.token, id);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, status: "SENT", number: num(ctx, 1) });
    const c = await contractOf(id);
    expect(c.contractFields.find((x) => x.db_column === "employee_name").value).toBe("After Rename");
    // Later changes to the employee never reach the sent contract.
    await e.update({ full_name: "Third Name" });
    expect((await contractOf(id)).contractFields.find((x) => x.db_column === "employee_name").value).toBe("After Rename");
  });

  it("answers a blocked draft with its code, keeps it DRAFT with the reason, and clears the reason once sent", async () => {
    const e = await newEmployee(ctx, {}, { accountStatus: "INACTIVE" });
    const id = await draftOf(e);
    const res = await sendDraft(ctx.token, id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_RECIPIENT_INACTIVE"));
    expect((await db.Contract.findByPk(id)).meta.block).toEqual({ code: "CONTRACT_RECIPIENT_INACTIVE" });
    await db.HrmsAccount.update({ status: "ACTIVE" }, { where: { user_id: e.user_id } });
    expect((await sendDraft(ctx.token, id)).status).toBe(200);
    expect((await db.Contract.findByPk(id)).meta.block).toBeUndefined();
  });

  it("answers a missing value with 400 CONTRACT_FIELD_MISSING", async () => {
    const template = await makeTemplate(ctx.employer, { document: ctx.document, type: ctx.type, fields: [mergeField("EMPLOYEE", "designation", { label: "Designation" }), sig()] });
    const e = await newEmployee(ctx);
    const id = (await draftsFor(ctx, [e.id], { templateId: template.id })).body.data.results[0].contractId;
    const res = await sendDraft(ctx.token, id);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("CONTRACT_FIELD_MISSING", "en", { fields: "Designation" }));
  });

  it("re-checks the end and sign-by dates at send", async () => {
    const e = await newEmployee(ctx);
    const id = await draftOf(e);
    await db.Contract.update({ end_date: inDays(-1), start_date: inDays(-10) }, { where: { id } });
    expect((await sendDraft(ctx.token, id)).body).toEqual(validationBody({ end_date: "endDatePast" }));
    const c = await db.Contract.findByPk(id);
    await c.update({ end_date: null, meta: { ...c.meta, sign_by: today() } });
    expect((await sendDraft(ctx.token, id)).body).toEqual(validationBody({ sign_by: "signByRange" }));
  });

  it("sends a draft whose template was archived since", async () => {
    const template = await makeTemplate(ctx.employer, { document: ctx.document, type: ctx.type });
    const e = await newEmployee(ctx);
    const id = (await draftsFor(ctx, [e.id], { templateId: template.id })).body.data.results[0].contractId;
    await template.update({ status: "ARCHIVED" });
    expect((await sendDraft(ctx.token, id)).status).toBe(200);
  });

  it("409 CONTRACT_STATUS_INVALID for a non-draft", async () => {
    const e = await newEmployee(ctx);
    const id = await draftOf(e);
    await sendDraft(ctx.token, id);
    const res = await sendDraft(ctx.token, id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
  });

  it("lets exactly one of two sends to the same recipient and type win", async () => {
    const e = await newEmployee(ctx);
    const [d1, d2] = [await draftOf(e), await draftOf(e)];
    const [r1, r2] = await Promise.all([sendDraft(ctx.token, d1), sendDraft(ctx.token, d2)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    expect(loser.body.code).toBe("CONTRACT_ACTIVE_EXISTS");
    expect(await db.Contract.count({ where: { id: [d1, d2], status: "SENT" } })).toBe(1);
  });

  it("serialises a send with an edit or a delete of the same draft", async () => {
    const e1 = await newEmployee(ctx);
    const id1 = await draftOf(e1);
    const [sent, edited] = await Promise.all([sendDraft(ctx.token, id1), api.put(`/contracts/${id1}`, ctx.token, { name: "Edited" })]);
    const c1 = await db.Contract.findByPk(id1);
    if (edited.status === 200) expect(c1.name).toBe("Edited");
    else expect(edited.body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
    expect(sent.status).toBe(200);

    const e2 = await newEmployee(ctx);
    const id2 = await draftOf(e2);
    const [s2, d2] = await Promise.all([sendDraft(ctx.token, id2), api.delete(`/contracts/${id2}`, ctx.token)]);
    if (s2.status === 200) expect(d2.body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
    else {
      expect(s2.body).toEqual(errorBody("NOT_FOUND"));
      expect(d2.status).toBe(200);
    }
  });

  it("404 for another company's draft", async () => {
    const other = await setupCompany("Other");
    const e = await newEmployee(other);
    const id = (await draftsFor(other, [e.id])).body.data.results[0].contractId;
    const res = await sendDraft(ctx.token, id);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it("403 for a sub-admin without contract:create; allowed with it", async () => {
    const e = await newEmployee(ctx);
    const id = await draftOf(e);
    const denied = await hrLogin(ctx.employer, { can_read: true, can_update: true, can_delete: true });
    expect((await sendDraft(denied.token, id)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await send(ctx, [e.id], {}, denied.token)).status).toBe(403);
    const allowed = await hrLogin(ctx.employer, { can_create: true });
    expect((await sendDraft(allowed.token, id)).status).toBe(200);
  });
});

