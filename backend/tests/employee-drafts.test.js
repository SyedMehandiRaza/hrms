const { db, MISSING_ID, ISO, errorBody, validationBody, ownerCompany, loginFor, api, NO_FLAGS } = require("./helpers/api");

// Employee drafts API (ticket workforce#12; workforce D53): saved on any step with no field
// validation, shared within the company by everyone with employee:create.

afterAll(async () => {
  await db.sequelize.close();
});

const CREATOR = { employee: { can_create: true } };
const MB = 1024 * 1024;
const bigData = (bytes) => ({ notes: "x".repeat(bytes - JSON.stringify({ notes: "" }).length) });

// Moves a draft's last save into the past (Sequelize would reset updated_at on a model update).
const backdate = (draft) =>
  db.sequelize.query("UPDATE hrms_employee_drafts SET updated_at = ? WHERE id = ?", { replacements: [new Date("2026-01-01T00:00:00Z"), draft.id] });

const save = async (token, body) => {
  const res = await api.post("/api/employee-drafts", token, body);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.data;
};

describe("POST /api/employee-drafts", () => {
  it("saves a draft on step 2 with only a name → 201; no field validation runs", async () => {
    const ctx = await ownerCompany();
    const creator = await loginFor(ctx.employer, "SUB_ADMIN", CREATOR);
    const data = { basic: { fullName: "A", email: "not-an-email", phone: "12" }, job: {} };
    const res = await api.post("/api/employee-drafts", creator.token, { step: 2, fullName: "A", email: "not-an-email", data });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: expect.any(String),
      full_name: "A",
      email: "not-an-email",
      current_step: 2,
      total_steps: 5,
      data,
      last_saved_at: ISO,
      saved_by: { id: creator.person.id, name: creator.person.name },
    });
    const row = await db.EmployeeDraft.findByPk(res.body.data.id);
    expect(row).toMatchObject({ employer_id: ctx.employer.id, created_by: creator.person.id, updated_by: creator.person.id, current_step: 2 });
  });

  it("an empty draft (no name, no email) is allowed", async () => {
    const ctx = await ownerCompany();
    const draft = await save(ctx.token, { step: 1, data: {} });
    expect(draft).toMatchObject({ full_name: null, email: null, current_step: 1, data: {} });
  });

  it("data of exactly 1 MB is accepted", async () => {
    const ctx = await ownerCompany();
    const res = await api.post("/api/employee-drafts", ctx.token, { step: 3, data: bigData(MB) });
    expect(res.status).toBe(201);
  });

  it.each([
    ["just over 1 MB", MB + 1],
    ["far over 1 MB (bigger than the request limit)", 3 * MB],
  ])("data %s → 400 data 'Draft is too large (max 1 MB).'", async (_label, bytes) => {
    const ctx = await ownerCompany();
    const res = await api.post("/api/employee-drafts", ctx.token, { step: 3, data: bigData(bytes) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ data: "draftTooLarge" }));
    expect(res.body.errors.data).toBe("Draft is too large (max 1 MB).");
    expect(await db.EmployeeDraft.count({ where: { employer_id: ctx.employer.id } })).toBe(0);
  });

  it.each([
    [{ step: 2 }, "data"],
    [{ step: 2, data: "text" }, "data"],
    [{ step: 2, data: [1, 2] }, "data"],
    [{ step: 0, data: {} }, "step"],
    [{ step: 6, data: {} }, "step"],
    [{ step: 2.5, data: {} }, "step"],
    [{ data: {} }, "step"],
  ])("a malformed body %j → 400 VALIDATION_FAILED on %s", async (body, field) => {
    const ctx = await ownerCompany();
    const res = await api.post("/api/employee-drafts", ctx.token, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ [field]: "VALIDATION_FAILED" }));
  });
});

describe("PUT /api/employee-drafts/:id", () => {
  it("saving again updates the same draft (step, data, last saved, saved by)", async () => {
    const ctx = await ownerCompany();
    const first = await save(ctx.token, { step: 1, fullName: "Ahmed", data: { basic: { fullName: "Ahmed" } } });
    await backdate(first);
    const other = await loginFor(ctx.employer, "EMPLOYEE", CREATOR);
    const data = { basic: { fullName: "Ahmed Ali" }, job: { employmentType: "FULL_TIME" } };
    const res = await api.put(`/api/employee-drafts/${first.id}`, other.token, { step: 3, fullName: "Ahmed Ali", email: "ahmed@x.test", data });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: first.id,
      full_name: "Ahmed Ali",
      email: "ahmed@x.test",
      current_step: 3,
      data,
      saved_by: { id: other.person.id, name: other.person.name },
    });
    expect(new Date(res.body.data.last_saved_at).getTime()).toBeGreaterThan(new Date("2026-01-02").getTime());
    expect(await db.EmployeeDraft.count({ where: { employer_id: ctx.employer.id } })).toBe(1);
    expect((await db.EmployeeDraft.findByPk(first.id)).created_by).toBe(ctx.owner.id);
  });

  it("over 1 MB → 400 and the draft is unchanged", async () => {
    const ctx = await ownerCompany();
    const draft = await save(ctx.token, { step: 1, data: { a: 1 } });
    const res = await api.put(`/api/employee-drafts/${draft.id}`, ctx.token, { step: 2, data: bigData(MB + 10) });
    expect(res.body).toEqual(validationBody({ data: "draftTooLarge" }));
    expect((await db.EmployeeDraft.findByPk(draft.id)).current_step).toBe(1);
  });

  it("an unknown, malformed or other company's id → 404", async () => {
    const ctx = await ownerCompany();
    const other = await ownerCompany();
    const theirs = await save(other.token, { step: 1, data: {} });
    for (const id of [MISSING_ID, "nope", theirs.id]) {
      const res = await api.put(`/api/employee-drafts/${id}`, ctx.token, { step: 2, data: {} });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("GET /api/employee-drafts and /:id", () => {
  it("lists name, progress, last saved and saved by, newest first; never another company's", async () => {
    const ctx = await ownerCompany();
    const other = await ownerCompany();
    await save(other.token, { step: 1, fullName: "Theirs", data: {} });
    const old = await save(ctx.token, { step: 1, fullName: "Old One", data: { big: "kept out of the list" } });
    const untitled = await save(ctx.token, { step: 4, data: {} });
    await backdate(old);
    const res = await api.get("/api/employee-drafts", ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      items: [
        { id: untitled.id, full_name: null, email: null, current_step: 4, total_steps: 5, last_saved_at: ISO, saved_by: { id: ctx.owner.id, name: ctx.owner.name } },
        { id: old.id, full_name: "Old One", email: null, current_step: 1, total_steps: 5, last_saved_at: ISO, saved_by: { id: ctx.owner.id, name: ctx.owner.name } },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });
  });

  it("pages the list", async () => {
    const ctx = await ownerCompany();
    for (let i = 0; i < 3; i += 1) await save(ctx.token, { step: 1, data: {} });
    const res = await api.get("/api/employee-drafts", ctx.token, { query: { page: 2, limit: 2 } });
    expect(res.body.data).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(res.body.data.items).toHaveLength(1);
    expect((await api.get("/api/employee-drafts", ctx.token, { query: { limit: 101 } })).body).toEqual(validationBody({ limit: "VALIDATION_FAILED" }));
  });

  it("another user with employee:create in the same company opens and resumes it", async () => {
    const ctx = await ownerCompany();
    const a = await loginFor(ctx.employer, "SUB_ADMIN", CREATOR);
    const b = await loginFor(ctx.employer, "GENERAL_EMPLOYEE", CREATOR);
    const draft = await save(a.token, { step: 2, fullName: "Sami", data: { basic: { fullName: "Sami" } } });
    const res = await api.get(`/api/employee-drafts/${draft.id}`, b.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(draft);
    expect((await api.get("/api/employee-drafts", b.token)).body.data.items.map((d) => d.id)).toEqual([draft.id]);
  });

  it("another company's, unknown or malformed id → 404", async () => {
    const ctx = await ownerCompany();
    const other = await ownerCompany();
    const theirs = await save(other.token, { step: 1, data: {} });
    for (const id of [MISSING_ID, "nope", theirs.id]) {
      expect((await api.get(`/api/employee-drafts/${id}`, ctx.token)).body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("DELETE /api/employee-drafts/:id", () => {
  it("removes it from the list; it can't be opened again", async () => {
    const ctx = await ownerCompany();
    const draft = await save(ctx.token, { step: 1, data: {} });
    const res = await api.delete(`/api/employee-drafts/${draft.id}`, ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: draft.id });
    expect((await api.get("/api/employee-drafts", ctx.token)).body.data.items).toEqual([]);
    expect((await api.get(`/api/employee-drafts/${draft.id}`, ctx.token)).status).toBe(404);
    expect((await api.delete(`/api/employee-drafts/${draft.id}`, ctx.token)).status).toBe(404);
  });

  it("another company's draft → 404 and it stays", async () => {
    const ctx = await ownerCompany();
    const other = await ownerCompany();
    const theirs = await save(other.token, { step: 1, data: {} });
    expect((await api.delete(`/api/employee-drafts/${theirs.id}`, ctx.token)).body).toEqual(errorBody("NOT_FOUND"));
    expect(await db.EmployeeDraft.findByPk(theirs.id)).not.toBeNull();
  });
});

describe("permissions", () => {
  it("FORBIDDEN without employee:create (any other flag doesn't count); staffing login → 403; no token → 401", async () => {
    const ctx = await ownerCompany();
    const draft = await save(ctx.token, { step: 1, data: {} });
    const calls = (token) => [
      api.get("/api/employee-drafts", token),
      api.post("/api/employee-drafts", token, { step: 1, data: {} }),
      api.get(`/api/employee-drafts/${draft.id}`, token),
      api.put(`/api/employee-drafts/${draft.id}`, token, { step: 2, data: {} }),
      api.delete(`/api/employee-drafts/${draft.id}`, token),
    ];
    for (const level of ["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE"]) {
      const { token } = await loginFor(ctx.employer, level, { employee: { ...NO_FLAGS, can_read: true, can_update: true, can_delete: true } });
      for (const res of await Promise.all(calls(token))) {
        expect(res.status).toBe(403);
        expect(res.body).toEqual(errorBody("FORBIDDEN"));
      }
    }
    const noRole = (await loginFor(ctx.employer, "SUB_ADMIN")).token;
    expect((await api.get("/api/employee-drafts", noRole)).body).toEqual(errorBody("FORBIDDEN"));
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", CREATOR)).token;
    for (const res of await Promise.all(calls(staffing))) expect(res.status).toBe(403);
    for (const res of await Promise.all(calls(null))) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
    }
    expect(await db.EmployeeDraft.findByPk(draft.id)).not.toBeNull();
  });
});
