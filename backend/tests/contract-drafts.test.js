const crypto = require("crypto");
const h = require("./helpers/contracts");
const f = require("./helpers/contractFixtures");

const { db, api, errorBody, validationBody, createCompany, hrLogin, createEmployee, createStaffingCompany } = h;
const { setupCompany, draftsFor, createContracts, terms, today, inDays, makeTemplate, sig } = f;

// Drafts API: create (one per recipient), edit name/terms, delete (ticket contract-studio#07;
// plan decisions 18–22, 25, 42).

afterAll(() => db.sequelize.close());

const editDraft = (token, id, body) => api.put(`/contracts/${id}`, token, body);
const deleteDraft = (token, id) => api.delete(`/contracts/${id}`, token);

describe("create drafts", () => {
  let ctx;
  let emps;

  beforeAll(async () => {
    ctx = await setupCompany();
    emps = [];
    for (const name of ["Sara Khan", "Omar Farooq", "Ali Hassan"]) emps.push((await createEmployee(ctx.employer, { full_name: name })).employee);
  });

  it("saves one DRAFT per recipient with no number, a PRIMARY_SIGNER, the template's fields and type, and a CREATED activity", async () => {
    const res = await draftsFor(ctx, emps.map((e) => e.id), { rate: 4500, rate_unit: "MONTHLY", notice_period_days: 30, renewal_due: inDays(200), end_date: inDays(365) });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ sent: 0, drafts: 3, failed: 0 });
    expect(res.body.data.results.map((r) => [r.recipientName, r.result])).toEqual([
      ["Sara Khan", "DRAFT"],
      ["Omar Farooq", "DRAFT"],
      ["Ali Hassan", "DRAFT"],
    ]);
    for (const [i, r] of res.body.data.results.entries()) {
      const c = await db.Contract.findByPk(r.contractId, { include: ["contractRecipients", "contractFields", "contractActivities"] });
      expect(c).toMatchObject({
        status: "DRAFT",
        reference_no: null,
        audience_type: "EMPLOYEE",
        contract_type_id: ctx.type.id,
        template_id: ctx.template.id,
        document_id: ctx.document.id,
        name: "Employment Agreement",
        start_date: today(),
        end_date: inDays(365),
        renewal_due: inDays(200),
        rate: "4500.00",
        rate_unit: "MONTHLY",
        currency: "SAR",
        notice_period_days: 30,
        recipient_key: `E:${emps[i].id}`,
        created_by: ctx.owner.id,
        expires_at: null,
      });
      expect(c.meta).toMatchObject({ sign_by: inDays(7) });
      expect(c.contractRecipients).toHaveLength(1);
      expect(c.contractRecipients[0]).toMatchObject({ role: "PRIMARY_SIGNER", recipient_type: "EMPLOYEE", employee_id: emps[i].id, recipient_name: emps[i].full_name });
      expect(c.contractFields.map((x) => [x.field_type, x.db_column, x.value]).sort()).toEqual([
        ["DB_COLUMN", "employee_name", null],
        ["SIGNATURE", null, null],
      ]);
      expect(c.contractFields.every((x) => x.recipient_id === c.contractRecipients[0].id)).toBe(true);
      expect(c.contractActivities.map((a) => a.action)).toEqual(["CREATED"]);
      expect(c.contractActivities[0]).toMatchObject({ actor_user_id: ctx.owner.id, meta: { template_id: ctx.template.id, contract_type_id: ctx.type.id } });
    }
  });

  it("saves a staffing-company draft from a staffing template", async () => {
    const { company: s } = await createStaffingCompany(ctx.employer, { name: "Gulf Manpower" });
    const res = await createContracts(ctx.token, { mode: "DRAFT", templateId: ctx.staffingTemplate.id, recipientIds: [s.id], ...terms() });
    const c = await db.Contract.findByPk(res.body.data.results[0].contractId, { include: ["contractRecipients"] });
    expect(c).toMatchObject({ audience_type: "STAFFING_COMPANY", recipient_key: `S:${s.id}`, contract_type_id: ctx.staffType.id });
    expect(c.contractRecipients[0]).toMatchObject({ recipient_type: "STAFFING_COMPANY", staffing_company_id: s.id, recipient_name: "Gulf Manpower" });
  });

  it("uses the given name, else the template's name", async () => {
    const res = await draftsFor(ctx, [emps[0].id], { name: "Sara's Contract" });
    expect((await db.Contract.findByPk(res.body.data.results[0].contractId)).name).toBe("Sara's Contract");
  });

  it("defaults sign-by to today + 7 and currency to SAR", async () => {
    const res = await createContracts(ctx.token, { mode: "DRAFT", templateId: ctx.template.id, recipientIds: [emps[0].id], start_date: today() });
    const c = await db.Contract.findByPk(res.body.data.results[0].contractId);
    expect(c.meta.sign_by).toBe(inDays(7));
    expect(c.currency).toBe("SAR");
  });

  it("accepts a start date in the past", async () => {
    expect((await draftsFor(ctx, [emps[0].id], { start_date: "2020-01-01" })).status).toBe(201);
  });

  it("creates one draft for a recipient id given twice", async () => {
    const res = await draftsFor(ctx, [emps[1].id, emps[1].id]);
    expect(res.body.data.results).toHaveLength(1);
  });

  it.each([
    [{ templateId: undefined }, { templateId: "contractTemplateRequired" }],
    [{ recipientIds: [] }, { recipientIds: "contractRecipientsRequired" }],
    [{ recipientIds: undefined }, { recipientIds: "contractRecipientsRequired" }],
    [{ start_date: undefined }, { start_date: "startDateRequired" }],
    [{ start_date: "2026-02-30" }, { start_date: "dateInvalid" }],
    [{ end_date: "2026-13-01" }, { end_date: "dateInvalid" }],
    [{ renewal_due: "nope" }, { renewal_due: "dateInvalid" }],
    [{ name: "n".repeat(256) }, { name: "contractNameMax" }],
    [{ rate: 0, rate_unit: "MONTHLY" }, { rate: "rateInvalid" }],
    [{ rate: -5, rate_unit: "MONTHLY" }, { rate: "rateInvalid" }],
    [{ rate: 10.555, rate_unit: "MONTHLY" }, { rate: "rateInvalid" }],
    [{ rate: 100 }, { rate_unit: "rateUnitRequired" }],
    [{ rate: 100, rate_unit: "WEEKLY" }, { rate_unit: "rateUnitRequired" }],
    [{ currency: "XYZ" }, { currency: "currencyInvalid" }],
    [{ currency: "sar1" }, { currency: "currencyInvalid" }],
    [{ notice_period_days: -1 }, { notice_period_days: "noticePeriodRange" }],
    [{ notice_period_days: 366 }, { notice_period_days: "noticePeriodRange" }],
    [{ notice_period_days: 1.5 }, { notice_period_days: "noticePeriodRange" }],
  ])("400 for %j", async (overrides, fields) => {
    const res = await draftsFor(ctx, [emps[0].id], overrides);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(fields));
  });

  it("checks dates against the company's today", async () => {
    const cases = [
      [{ start_date: inDays(10), end_date: inDays(9) }, { end_date: "endDateBeforeStart" }],
      [{ start_date: inDays(-30), end_date: inDays(-1) }, { end_date: "endDatePast" }],
      [{ start_date: inDays(10), end_date: inDays(100), renewal_due: inDays(9) }, { renewal_due: "renewalDueRange" }],
      [{ start_date: inDays(10), end_date: inDays(100), renewal_due: inDays(101) }, { renewal_due: "renewalDueRange" }],
      [{ start_date: inDays(10), renewal_due: inDays(5) }, { renewal_due: "renewalDueRange" }],
      [{ sign_by: today() }, { sign_by: "signByRange" }],
      [{ sign_by: inDays(91) }, { sign_by: "signByRange" }],
      [{ sign_by: "2026-02-31" }, { sign_by: "signByRange" }],
    ];
    for (const [overrides, fields] of cases) {
      const res = await draftsFor(ctx, [emps[0].id], overrides);
      expect([overrides, res.status, res.body]).toEqual([overrides, 400, validationBody(fields)]);
    }
    for (const ok of [{ sign_by: inDays(1) }, { sign_by: inDays(90) }, { end_date: today() }, { start_date: inDays(1), end_date: inDays(1), renewal_due: inDays(1) }]) {
      expect([ok, (await draftsFor(ctx, [emps[0].id], ok)).status]).toEqual([ok, 201]);
    }
  });

  it("answers validation in Arabic", async () => {
    const res = await draftsFor(ctx, [emps[0].id], { start_date: undefined }, null);
    expect(res.status).toBe(401);
    const ar = await createContracts(ctx.token, { mode: "DRAFT", templateId: ctx.template.id, recipientIds: [emps[0].id] }, { lang: "ar" });
    expect(ar.body).toEqual(validationBody({ start_date: "startDateRequired" }, "ar"));
  });

  it("refuses 201 recipients → 400 CONTRACT_BULK_LIMIT", async () => {
    const ids = Array.from({ length: 201 }, () => crypto.randomUUID());
    const res = await draftsFor(ctx, ids);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("CONTRACT_BULK_LIMIT"));
  });

  it("refuses an archived template → 409 CONTRACT_TEMPLATE_INACTIVE", async () => {
    const archived = await makeTemplate(ctx.employer, { document: ctx.document, type: ctx.type, status: "ARCHIVED" });
    const res = await draftsFor(ctx, [emps[0].id], { templateId: archived.id });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_TEMPLATE_INACTIVE"));
  });

  it("404 for a missing or another company's template", async () => {
    const other = await setupCompany("Other");
    for (const templateId of [other.template.id, "00000000-0000-4000-a000-000000000000"]) {
      const res = await draftsFor(ctx, [emps[0].id], { templateId });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
  });

  it("refuses a template whose audience is VENDOR (inserted directly) → 400 CONTRACT_AUDIENCE_UNSUPPORTED", async () => {
    const vendor = await makeTemplate(ctx.employer, { document: ctx.document, type: ctx.type, audience: "VENDOR", fields: [sig()] });
    const res = await draftsFor(ctx, [emps[0].id], { templateId: vendor.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("CONTRACT_AUDIENCE_UNSUPPORTED"));
  });

  it("404 and nothing created when one recipient isn't a record of the template's audience in this company", async () => {
    const before = await db.Contract.count({ where: { employer_id: ctx.employer.id } });
    const { company: staffing } = await createStaffingCompany(ctx.employer);
    const { employee: foreign } = await createEmployee((await createCompany()).employer);
    for (const bad of [crypto.randomUUID(), staffing.id, foreign.id]) {
      const res = await draftsFor(ctx, [emps[0].id, bad]);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
    expect(await db.Contract.count({ where: { employer_id: ctx.employer.id } })).toBe(before);
  });

  it("changes no employee, account or staffing-company row", async () => {
    const before = await db.Employee.findAll({ where: { employer_id: ctx.employer.id }, raw: true });
    await draftsFor(ctx, emps.map((e) => e.id));
    expect(await db.Employee.findAll({ where: { employer_id: ctx.employer.id }, raw: true })).toEqual(before);
  });
});

describe("edit and delete drafts", () => {
  let ctx;
  let emp;
  const newDraft = async (overrides) => (await draftsFor(ctx, [emp.id], overrides)).body.data.results[0].contractId;

  beforeAll(async () => {
    ctx = await setupCompany();
    ({ employee: emp } = await createEmployee(ctx.employer, { full_name: "Sara Khan" }));
  });

  it("edits a draft's name and terms with an UPDATED activity listing old → new", async () => {
    const id = await newDraft({ name: "Old Name", notice_period_days: 30 });
    const res = await editDraft(ctx.token, id, { name: "New Name", start_date: inDays(1), sign_by: inDays(10), notice_period_days: 60, currency: "USD" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, name: "New Name", status: "DRAFT", start_date: inDays(1), sign_by: inDays(10), notice_period_days: 60, currency: "USD" });
    const activity = await db.ContractActivity.findOne({ where: { contract_id: id, action: "UPDATED" } });
    expect(activity.actor_user_id).toBe(ctx.owner.id);
    expect(activity.meta.changes).toMatchObject({
      name: { from: "Old Name", to: "New Name" },
      start_date: { from: today(), to: inDays(1) },
      sign_by: { from: inDays(7), to: inDays(10) },
      notice_period_days: { from: 30, to: 60 },
      currency: { from: "SAR", to: "USD" },
    });
  });

  it("validates edits like creation", async () => {
    const id = await newDraft();
    const res = await editDraft(ctx.token, id, { start_date: inDays(5), end_date: inDays(4) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ end_date: "endDateBeforeStart" }));
  });

  it("ignores a template or recipient in the edit (only name and terms change)", async () => {
    const id = await newDraft();
    const { employee: other } = await createEmployee(ctx.employer);
    const res = await editDraft(ctx.token, id, { start_date: today(), templateId: ctx.staffingTemplate.id, recipientIds: [other.id], recipientId: other.id });
    expect(res.status).toBe(200);
    const c = await db.Contract.findByPk(id, { include: ["contractRecipients"] });
    expect(c.template_id).toBe(ctx.template.id);
    expect(c.contractRecipients[0].employee_id).toBe(emp.id);
  });

  it("soft-deletes a draft and keeps its activity rows", async () => {
    const id = await newDraft();
    const res = await deleteDraft(ctx.token, id);
    expect(res.status).toBe(200);
    expect(await db.Contract.findByPk(id)).toBeNull();
    expect(await db.Contract.findByPk(id, { paranoid: false })).not.toBeNull();
    expect(await db.ContractActivity.count({ where: { contract_id: id } })).toBeGreaterThan(0);
    expect((await deleteDraft(ctx.token, id)).status).toBe(404);
  });

  it.each(["SENT", "VIEWED", "SUBMITTED", "COMPLETED", "REJECTED", "EXPIRED", "REVOKED"])("409 CONTRACT_STATUS_INVALID when editing or deleting a %s contract", async (status) => {
    const { employee: own } = await createEmployee(ctx.employer);
    const id = (await draftsFor(ctx, [own.id])).body.data.results[0].contractId;
    await db.Contract.update({ status, reference_no: `CON-T-${h.short()}` }, { where: { id } });
    for (const res of [await editDraft(ctx.token, id, { start_date: today() }), await deleteDraft(ctx.token, id)]) {
      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("CONTRACT_STATUS_INVALID"));
    }
  });

  it("404 when editing or deleting another company's draft", async () => {
    const other = await setupCompany("Other");
    const { employee: e } = await createEmployee(other.employer);
    const foreignId = (await draftsFor(other, [e.id])).body.data.results[0].contractId;
    for (const res of [await editDraft(ctx.token, foreignId, { start_date: today() }), await deleteDraft(ctx.token, foreignId)]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("permissions", () => {
  let ctx;
  let emp;

  beforeAll(async () => {
    ctx = await setupCompany();
    ({ employee: emp } = await createEmployee(ctx.employer));
  });

  it("401 without a token", async () => {
    const res = await draftsFor(ctx, [emp.id], {}, null);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  const ACTIONS = {
    create: { flag: "can_create", call: (t) => draftsFor(ctx, [emp.id], {}, t) },
    edit: { flag: "can_update", call: async (t) => editDraft(t, (await draftsFor(ctx, [emp.id])).body.data.results[0].contractId, { start_date: today() }) },
    delete: { flag: "can_delete", call: async (t) => deleteDraft(t, (await draftsFor(ctx, [emp.id])).body.data.results[0].contractId) },
  };

  it.each(Object.keys(ACTIONS))("%s: 403 without its flag, allowed with it", async (action) => {
    const { flag, call } = ACTIONS[action];
    const others = Object.fromEntries(["can_read", "can_create", "can_update", "can_delete"].filter((x) => x !== flag).map((x) => [x, true]));
    const denied = await hrLogin(ctx.employer, others);
    const res = await call(denied.token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    const allowed = await hrLogin(ctx.employer, { [flag]: true });
    expect([200, 201]).toContain((await call(allowed.token)).status);
  });

  it("403 for the employee and the staffing company", async () => {
    const { user: e } = await createEmployee(ctx.employer);
    const { user: s } = await createStaffingCompany(ctx.employer);
    for (const user of [e, s]) {
      const res = await draftsFor(ctx, [emp.id], {}, await h.loginAs(user.email));
      expect(res.status).toBe(403);
    }
  });
});

