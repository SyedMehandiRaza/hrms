const { db, errorBody, validationBody, ownerCompany, createFinancialYear, loginFor, api, NO_FLAGS } = require("./helpers/api");
const { clock, addDays } = require("../src/utils/clock");

// Week-offs + copy to next year API (ticket workforce#07; workforce D38, D39).

const YEAR = new Date().getUTCFullYear();
const TODAY = `${YEAR}-10-20`;
beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const weekday = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
const daysOfYear = (year, test) => {
  const out = [];
  for (let d = `${year}-01-01`; d <= `${year}-12-31`; d = addDays(d, 1)) if (test(d)) out.push(d);
  return out;
};

const setup = async () => {
  const ctx = await ownerCompany();
  const fy = await db.FinancialYear.findOne({ where: { employer_id: ctx.employer.id } });
  const shift = await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Day", start_time: "08:00:00", end_time: "17:00:00" });
  return { ...ctx, fy, shift };
};
const putOffs = (ctx, dates, financialYearId = ctx.fy.id, shiftId = ctx.shift.id) =>
  api.put(`/api/shifts/${shiftId}/week-offs`, ctx.token, { financialYearId, dates });
const seedOffs = (ctx, dates, shift = ctx.shift) =>
  db.ShiftWeekOff.bulkCreate(dates.map((off_date) => ({ shift_id: shift.id, employer_id: ctx.employer.id, off_date })));
const offsOf = async (shift) => (await db.ShiftWeekOff.findAll({ where: { shift_id: shift.id }, order: [["off_date", "ASC"]], raw: true })).map((r) => r.off_date);

describe("PUT /api/shifts/:id/week-offs", () => {
  it("replaces the year's dates from today onward; past dates stay", async () => {
    const ctx = await setup();
    await seedOffs(ctx, [`${YEAR}-10-02`, `${YEAR}-10-23`, `${YEAR}-10-30`]);
    const res = await putOffs(ctx, [`${YEAR}-10-02`, `${YEAR}-10-24`, `${YEAR}-12-25`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ dates: [`${YEAR}-10-02`, `${YEAR}-10-24`, `${YEAR}-12-25`], today: TODAY, year_locked: false });
    expect(await offsOf(ctx.shift)).toEqual([`${YEAR}-10-02`, `${YEAR}-10-24`, `${YEAR}-12-25`]);
  });

  it.each([
    ["removing a past date", [`${YEAR}-10-02`], []],
    ["adding a past date", [], [`${YEAR}-10-19`]],
  ])("%s → 409 SHIFT_WEEKOFF_LOCKED and nothing changes", async (_label, existing, wanted) => {
    const ctx = await setup();
    await seedOffs(ctx, existing);
    const res = await putOffs(ctx, [...wanted, `${YEAR}-11-06`]);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("SHIFT_WEEKOFF_LOCKED"));
    expect(res.body.message).toBe("Week-offs in a closed or past period can't be changed.");
    expect(await offsOf(ctx.shift)).toEqual(existing);
  });

  it("changing a date in a locked month (or a closed year) → 409 SHIFT_WEEKOFF_LOCKED", async () => {
    const ctx = await setup();
    await db.PeriodLock.create({ employer_id: ctx.employer.id, financial_year_id: ctx.fy.id, period_year: YEAR, period_month: 11, module: "ALL", locked_at: new Date() });
    expect((await putOffs(ctx, [`${YEAR}-11-06`])).body).toEqual(errorBody("SHIFT_WEEKOFF_LOCKED"));
    expect((await putOffs(ctx, [`${YEAR}-12-04`])).status).toBe(200);
    await ctx.fy.update({ is_locked: true });
    expect((await putOffs(ctx, [`${YEAR}-12-04`, `${YEAR}-12-11`])).body).toEqual(errorBody("SHIFT_WEEKOFF_LOCKED"));
  });

  it.each([[`${YEAR + 1}-01-02`], ["2026-02-30"], ["soon"]])("a date outside the year (%s) → 400 dates 'Every date must fall in an existing financial year.'", async (d) => {
    const ctx = await setup();
    const res = await putOffs(ctx, [d]);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ dates: "weekOffOutsideFy" }));
  });

  it("another company's shift or year → 404", async () => {
    const ctx = await setup();
    const other = await setup();
    expect((await putOffs(ctx, [], ctx.fy.id, other.shift.id)).status).toBe(404);
    expect((await putOffs(ctx, [], other.fy.id)).status).toBe(404);
  });
});

describe("GET /api/shifts/:id/week-offs", () => {
  it("returns the year (default: the current one), its dates, today and the locked months", async () => {
    const ctx = await setup();
    await seedOffs(ctx, [`${YEAR}-03-06`]);
    await db.PeriodLock.create({ employer_id: ctx.employer.id, financial_year_id: ctx.fy.id, period_year: YEAR, period_month: 3, module: "ATTENDANCE", locked_at: new Date() });
    const res = await api.get(`/api/shifts/${ctx.shift.id}/week-offs`, ctx.token);
    expect(res.body.data).toMatchObject({
      financial_year: { id: ctx.fy.id, start_date: `${YEAR}-01-01`, end_date: `${YEAR}-12-31` },
      dates: [`${YEAR}-03-06`],
      today: TODAY,
      year_locked: false,
      locked_months: [`${YEAR}-03`],
    });
  });
});

describe("copy to next year", () => {
  const fridays = (year) => daysOfYear(year, (d) => weekday(d) === 5);

  // Fridays off all year (100%), Saturdays only until June (~50%).
  const withPattern = async () => {
    const ctx = await setup();
    await seedOffs(ctx, [...fridays(YEAR), ...daysOfYear(YEAR, (d) => weekday(d) === 6 && d < `${YEAR}-07-01`)]);
    const next = await createFinancialYear(ctx.employer, YEAR + 1, { status: "PLANNED" });
    return { ...ctx, next };
  };

  it("preview: the weekdays off on at least 80% of their occurrences, and how many dates would be added", async () => {
    const ctx = await withPattern();
    const res = await api.get("/api/shifts/week-offs/copy-preview", ctx.token, { query: { to_fy: ctx.next.id } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      from_fy: { id: ctx.fy.id },
      to_fy: { id: ctx.next.id },
      shifts: [{ shift_id: ctx.shift.id, name: "Day", weekdays: [5], dates_to_add: fridays(YEAR + 1).length }],
    });
  });

  it("copy adds those dates to the chosen shifts, never removes any, and running it twice adds nothing", async () => {
    const ctx = await withPattern();
    const kept = `${YEAR + 1}-01-03`; // a Saturday already off next year
    await seedOffs(ctx, [kept]);
    const res = await api.post("/api/shifts/week-offs/copy", ctx.token, { to_fy: ctx.next.id, shift_ids: [ctx.shift.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.added).toEqual({ [ctx.shift.id]: fridays(YEAR + 1).length });
    const nextYear = (await offsOf(ctx.shift)).filter((d) => d.startsWith(String(YEAR + 1)));
    expect(nextYear).toEqual([...fridays(YEAR + 1), kept].sort());
    const again = await api.post("/api/shifts/week-offs/copy", ctx.token, { to_fy: ctx.next.id, shift_ids: [ctx.shift.id] });
    expect(again.body.data.added).toEqual({ [ctx.shift.id]: 0 });
  });

  it("skips locked months of the next year", async () => {
    const ctx = await withPattern();
    await db.PeriodLock.create({ employer_id: ctx.employer.id, financial_year_id: ctx.next.id, period_year: YEAR + 1, period_month: 1, module: "ALL", locked_at: new Date() });
    const res = await api.post("/api/shifts/week-offs/copy", ctx.token, { shift_ids: [ctx.shift.id] });
    expect(res.body.data.added[ctx.shift.id]).toBe(fridays(YEAR + 1).filter((d) => !d.startsWith(`${YEAR + 1}-01`)).length);
  });

  it.each([
    ["the next year doesn't exist", async () => {}],
    ["the next year is closed", async (ctx) => createFinancialYear(ctx.employer, YEAR + 1, { status: "CLOSED" })],
    ["the next year is locked", async (ctx) => createFinancialYear(ctx.employer, YEAR + 1, { is_locked: true })],
  ])("%s → 409 SHIFT_WEEKOFF_NO_NEXT_FY (preview and copy)", async (_label, prepare) => {
    const ctx = await setup();
    await prepare(ctx);
    const preview = await api.get("/api/shifts/week-offs/copy-preview", ctx.token);
    expect(preview.status).toBe(409);
    expect(preview.body).toEqual(errorBody("SHIFT_WEEKOFF_NO_NEXT_FY"));
    expect(preview.body.message).toBe("The next financial year doesn't exist or is locked.");
    expect((await api.post("/api/shifts/week-offs/copy", ctx.token, { shift_ids: [ctx.shift.id] })).body).toEqual(errorBody("SHIFT_WEEKOFF_NO_NEXT_FY"));
  });

  it("a to_fy that isn't the next year → 409 SHIFT_WEEKOFF_NO_NEXT_FY", async () => {
    const ctx = await withPattern();
    expect((await api.get("/api/shifts/week-offs/copy-preview", ctx.token, { query: { to_fy: ctx.fy.id } })).status).toBe(409);
  });

  it("another company's shift ids → 404", async () => {
    const ctx = await withPattern();
    const other = await setup();
    expect((await api.post("/api/shifts/week-offs/copy", ctx.token, { shift_ids: [ctx.shift.id, other.shift.id] })).body).toEqual(errorBody("NOT_FOUND"));
  });
});

describe("permissions", () => {
  it("read may view the week-offs; changing and copying need shift:update", async () => {
    const ctx = await setup();
    const reader = (await loginFor(ctx.employer, "SUB_ADMIN", { shift: { can_read: true } })).token;
    expect((await api.get(`/api/shifts/${ctx.shift.id}/week-offs`, reader)).status).toBe(200);
    expect((await api.put(`/api/shifts/${ctx.shift.id}/week-offs`, reader, { financialYearId: ctx.fy.id, dates: [] })).body).toEqual(errorBody("FORBIDDEN"));
    expect((await api.get("/api/shifts/week-offs/copy-preview", reader)).status).toBe(403);
    expect((await api.post("/api/shifts/week-offs/copy", reader, { shift_ids: [ctx.shift.id] })).status).toBe(403);
    const none = (await loginFor(ctx.employer, "EMPLOYEE", { shift: NO_FLAGS })).token;
    expect((await api.get(`/api/shifts/${ctx.shift.id}/week-offs`, none)).status).toBe(403);
  });
});

// The years the week-off calendar can show (ticket workforce#23 wiring): the company's financial
// years with their lock state, oldest first.
describe("GET /api/shifts/week-offs/years", () => {
  it("lists the company's years with today, the closed/locked flag and the locked months; never another company's", async () => {
    const ctx = await setup();
    const other = await ownerCompany();
    const next = await createFinancialYear(ctx.employer, YEAR + 1, { status: "PLANNED" });
    const old = await createFinancialYear(ctx.employer, YEAR - 1, { status: "CLOSED", is_locked: true });
    await db.PeriodLock.create({ employer_id: ctx.employer.id, financial_year_id: ctx.fy.id, period_year: YEAR, period_month: 3, module: "ATTENDANCE", locked_at: new Date() });
    const res = await api.get("/api/shifts/week-offs/years", ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      today: TODAY,
      current_id: ctx.fy.id,
      years: [
        { id: old.id, label: old.label, start_date: `${YEAR - 1}-01-01`, end_date: `${YEAR - 1}-12-31`, status: "CLOSED", year_locked: true, locked_months: expect.any(Array) },
        { id: ctx.fy.id, label: ctx.fy.label, start_date: `${YEAR}-01-01`, end_date: `${YEAR}-12-31`, status: "OPEN", year_locked: false, locked_months: [`${YEAR}-03`] },
        { id: next.id, label: next.label, start_date: `${YEAR + 1}-01-01`, end_date: `${YEAR + 1}-12-31`, status: "PLANNED", year_locked: false, locked_months: [] },
      ],
    });
    expect((await api.get("/api/shifts/week-offs/years", other.token)).body.data.years.map((y) => y.id)).not.toContain(ctx.fy.id);
  });

  it("needs shift:read; staffing → 403; no token → 401", async () => {
    const ctx = await setup();
    const none = (await loginFor(ctx.employer, "SUB_ADMIN", { shift: NO_FLAGS })).token;
    expect((await api.get("/api/shifts/week-offs/years", none)).body).toEqual(errorBody("FORBIDDEN"));
    const reader = (await loginFor(ctx.employer, "EMPLOYEE", { shift: { can_read: true } })).token;
    expect((await api.get("/api/shifts/week-offs/years", reader)).status).toBe(200);
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { shift: { can_read: true } })).token;
    expect((await api.get("/api/shifts/week-offs/years", staffing)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await api.get("/api/shifts/week-offs/years", null)).status).toBe(401);
  });
});
