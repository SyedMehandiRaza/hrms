const { db, MISSING_ID, errorBody, validationBody, ownerCompany, loginFor, createEmployee, api, NO_FLAGS } = require("./helpers/api");
const { clock } = require("../src/utils/clock");

// Shifts API + timing history (ticket workforce#06; workforce D35–D37).

const YEAR = new Date().getUTCFullYear();
const TODAY = `${YEAR}-10-20`;
beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const ALL = { can_read: true, can_create: true, can_update: true, can_delete: true };
const body = (overrides = {}) => ({ name: "Day", start_time: "08:00", end_time: "17:00", ...overrides });
const createShift = async (ctx, overrides) => {
  const res = await api.post("/api/shifts", ctx.token, body(overrides));
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.data;
};

describe("POST /api/shifts", () => {
  it("creates a shift with one timing row effective from today", async () => {
    const ctx = await ownerCompany();
    const res = await api.post("/api/shifts", ctx.token, body());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Day",
      start_time: "08:00",
      end_time: "17:00",
      is_overnight: false,
      scheduled: [],
      history: [{ effective_from: TODAY, start_time: "08:00", end_time: "17:00", is_overnight: false, state: "IN_FORCE" }],
    });
    expect(await db.ShiftTimeHistory.count({ where: { shift_id: res.body.data.id } })).toBe(1);
  });

  it("accepts an overnight shift (end before start)", async () => {
    const ctx = await ownerCompany();
    const res = await api.post("/api/shifts", ctx.token, body({ name: "Night", start_time: "22:00", end_time: "06:00" }));
    expect(res.status).toBe(201);
    expect(res.body.data.is_overnight).toBe(true);
  });

  it("equal start and end → end_time 'End time must differ from start time.'", async () => {
    const ctx = await ownerCompany();
    const res = await api.post("/api/shifts", ctx.token, body({ start_time: "08:00", end_time: "08:00:00" }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ end_time: "endTimeSameAsStart" }));
  });

  it("reports the missing fields; a name over 50 → its text", async () => {
    const ctx = await ownerCompany();
    expect((await api.post("/api/shifts", ctx.token, {})).body).toEqual(
      validationBody({ name: "shiftNameRequired", start_time: "startTimeRequired", end_time: "endTimeRequired" })
    );
    expect((await api.post("/api/shifts", ctx.token, body({ name: "N".repeat(51) }))).body).toEqual(validationBody({ name: "shiftNameMax" }));
    expect((await api.post("/api/shifts", ctx.token, body({ start_time: "25:00" }))).body).toEqual(validationBody({ start_time: "startTimeRequired" }));
  });

  it("a duplicate name (any case) → 409 SHIFT_NAME_TAKEN; another company may use it", async () => {
    const ctx = await ownerCompany();
    await createShift(ctx);
    const res = await api.post("/api/shifts", ctx.token, body({ name: "DAY" }));
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("SHIFT_NAME_TAKEN"));
    expect(res.body.message).toBe("A shift with this name already exists.");
    expect((await api.post("/api/shifts", (await ownerCompany()).token, body())).status).toBe(201);
  });
});

describe("PUT /api/shifts/:id", () => {
  it("new times effective next week → a new Scheduled row; today's times are unchanged", async () => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    const res = await api.put(`/api/shifts/${s.id}`, ctx.token, body({ start_time: "07:00", end_time: "16:00", effective_from: `${YEAR}-10-27` }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      start_time: "08:00",
      end_time: "17:00",
      scheduled: [{ effective_from: `${YEAR}-10-27`, start_time: "07:00", end_time: "16:00", state: "SCHEDULED" }],
    });
    expect(res.body.data.history.map((h) => h.state)).toEqual(["SCHEDULED", "IN_FORCE"]);

    // When that day comes, the new times are in force.
    clock.now.mockReturnValue(new Date(`${YEAR}-10-27T09:00:00Z`));
    expect((await api.get(`/api/shifts/${s.id}`, ctx.token)).body.data).toMatchObject({ start_time: "07:00", scheduled: [] });
  });

  it("new times without effective_from apply from today; the same day again replaces that row", async () => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    await api.put(`/api/shifts/${s.id}`, ctx.token, body({ start_time: "09:00", end_time: "18:00" }));
    const res = await api.put(`/api/shifts/${s.id}`, ctx.token, body({ start_time: "10:00", end_time: "19:00" }));
    expect(res.body.data).toMatchObject({ start_time: "10:00", end_time: "19:00" });
    expect(await db.ShiftTimeHistory.count({ where: { shift_id: s.id } })).toBe(1);
  });

  it("a name-only edit adds no timing row", async () => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    const res = await api.put(`/api/shifts/${s.id}`, ctx.token, body({ name: "Morning", effective_from: `${YEAR}-11-01` }));
    expect(res.body.data.name).toBe("Morning");
    expect(await db.ShiftTimeHistory.count({ where: { shift_id: s.id } })).toBe(1);
  });

  it.each([
    ["before the financial year's start", `${YEAR - 1}-12-31`, null],
    ["in a locked month", `${YEAR}-10-05`, "lock"],
    ["in a closed year", `${YEAR}-10-05`, "closed"],
    ["a malformed date", "next week", null],
  ])("an effective_from %s → effective_from error", async (_label, day, kind) => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    const fy = await db.FinancialYear.findOne({ where: { employer_id: ctx.employer.id } });
    if (kind === "lock") {
      await db.PeriodLock.create({ employer_id: ctx.employer.id, financial_year_id: fy.id, period_year: YEAR, period_month: 10, module: "ATTENDANCE", locked_at: new Date() });
    }
    if (kind === "closed") await fy.update({ status: "CLOSED" });
    const res = await api.put(`/api/shifts/${s.id}`, ctx.token, body({ start_time: "07:00", end_time: "16:00", effective_from: day }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ effective_from: "shiftEffectiveFromInvalid" }));
    expect(res.body.errors.effective_from).toBe("Choose a date from the start of the financial year that isn't in a closed or locked period.");
  });

  it("a payroll-only lock doesn't block a time change", async () => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    const fy = await db.FinancialYear.findOne({ where: { employer_id: ctx.employer.id } });
    await db.PeriodLock.create({ employer_id: ctx.employer.id, financial_year_id: fy.id, period_year: YEAR, period_month: 10, module: "PAYROLL", locked_at: new Date() });
    expect((await api.put(`/api/shifts/${s.id}`, ctx.token, body({ start_time: "07:00", end_time: "16:00" }))).status).toBe(200);
  });

  it("taking another shift's name → 409; another company's shift → 404", async () => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    await createShift(ctx, { name: "Night", start_time: "22:00", end_time: "06:00" });
    expect((await api.put(`/api/shifts/${s.id}`, ctx.token, body({ name: "night" }))).body).toEqual(errorBody("SHIFT_NAME_TAKEN"));
    const theirs = await createShift(await ownerCompany());
    expect((await api.put(`/api/shifts/${theirs.id}`, ctx.token, body())).status).toBe(404);
  });
});

describe("DELETE /api/shifts/:id", () => {
  it.each(["ACTIVE", "IN_NOTICE"])("a shift used by an %s employee → 409 SHIFT_IN_USE", async (status) => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    await createEmployee(ctx.employer, { shift_id: s.id, employment_status: status });
    const res = await api.delete(`/api/shifts/${s.id}`, ctx.token);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("SHIFT_IN_USE"));
    expect(res.body.message).toBe("This shift is assigned to employees and can't be deleted.");
  });

  it("an unused shift (or one only exited employees had) is soft-deleted and its name can be reused", async () => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    await createEmployee(ctx.employer, { shift_id: s.id, employment_status: "EXITED" });
    expect((await api.delete(`/api/shifts/${s.id}`, ctx.token)).body).toEqual({ success: true, data: { id: s.id } });
    expect(await db.CompanyShift.findByPk(s.id, { paranoid: false })).not.toBeNull();
    expect((await api.get(`/api/shifts/${s.id}`, ctx.token)).status).toBe(404);
    expect((await api.post("/api/shifts", ctx.token, body())).status).toBe(201);
  });
});

describe("GET /api/shifts", () => {
  it("lists the company's shifts by name with current times, searchable and paged", async () => {
    const ctx = await ownerCompany();
    await createShift(ctx, { name: "Night", start_time: "22:00", end_time: "06:00" });
    await createShift(ctx);
    await createShift(await ownerCompany(), { name: "Theirs" });
    const all = (await api.get("/api/shifts", ctx.token)).body.data;
    expect(all.items.map((s) => [s.name, s.start_time, s.is_overnight])).toEqual([
      ["Day", "08:00", false],
      ["Night", "22:00", true],
    ]);
    expect((await api.get("/api/shifts", ctx.token, { query: { search: "nig" } })).body.data.items.map((s) => s.name)).toEqual(["Night"]);
    expect((await api.get("/api/shifts", ctx.token, { query: { limit: 1, page: 2 } })).body.data).toMatchObject({ total: 2, page: 2 });
  });

  it.each([MISSING_ID, "nope"])("an unknown id (%s) → 404", async (id) => {
    const ctx = await ownerCompany();
    expect((await api.get(`/api/shifts/${id}`, ctx.token)).body).toEqual(errorBody("NOT_FOUND"));
  });
});

describe("permissions", () => {
  it("no shift flags → 403 everywhere; read only → list/view but no changes; no token → 401", async () => {
    const ctx = await ownerCompany();
    const s = await createShift(ctx);
    const none = (await loginFor(ctx.employer, "SUB_ADMIN", { shift: NO_FLAGS })).token;
    for (const res of [
      await api.get("/api/shifts", none),
      await api.get(`/api/shifts/${s.id}`, none),
      await api.post("/api/shifts", none, body({ name: "X" })),
      await api.put(`/api/shifts/${s.id}`, none, body()),
      await api.delete(`/api/shifts/${s.id}`, none),
    ]) {
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    }
    const reader = (await loginFor(ctx.employer, "EMPLOYEE", { shift: { can_read: true } })).token;
    expect((await api.get("/api/shifts", reader)).status).toBe(200);
    expect((await api.post("/api/shifts", reader, body({ name: "X" }))).status).toBe(403);
    expect((await api.get("/api/shifts", null)).status).toBe(401);
  });

  it("a SUB_ADMIN with every shift flag manages shifts; a staffing login can't", async () => {
    const ctx = await ownerCompany();
    const sub = (await loginFor(ctx.employer, "SUB_ADMIN", { shift: ALL })).token;
    const created = await api.post("/api/shifts", sub, body());
    expect(created.status).toBe(201);
    expect((await api.delete(`/api/shifts/${created.body.data.id}`, sub)).status).toBe(200);
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { shift: ALL })).token;
    expect((await api.get("/api/shifts", staffing)).status).toBe(403);
  });
});
