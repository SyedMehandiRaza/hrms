const { db, MISSING_ID, errorBody, validationBody, loginFor, createProject, api, NO_FLAGS } = require("./helpers/api");
const { employeeSetup, createdEmployee } = require("./helpers/employees");
const { clock } = require("../src/utils/clock");
const { mainProjectOn } = require("../src/services/employeeMainProject.service");

// Main project change API (ticket workforce#15; workforce D55).

const TODAY = "2026-10-21";

beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

let phoneNo = 3000;
const add = (ctx, overrides = {}) =>
  createdEmployee(ctx, { phone: `05014${String((phoneNo += 1)).padStart(5, "0")}`, joiningDate: "2026-03-01", ...overrides });
const move = (ctx, employee, body, token = ctx.token) => api.put(`/api/employees/${employee.id}/main-project`, token, body);

const assignments = (employee) => db.EmployeeProject.findAll({ where: { employee_id: employee.id }, raw: true });
const periods = (employee) => db.EmployeeMainProjectPeriod.findAll({ where: { employee_id: employee.id }, order: [["date_from", "ASC"]], raw: true });
const history = (employee) =>
  db.EmployeeProjectHistory.findAll({ where: { employee_id: employee.id, action: ["MOVED_OUT", "MOVED_IN", "REMOVED"] }, raw: true });

describe("PUT /api/employees/:id/main-project", () => {
  it("A → B effective today: B main, A secondary; MOVED_OUT/MOVED_IN with the date; A's period ends yesterday, B's starts today", async () => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer);
    const employee = await add(ctx, { projectIds: [ctx.project.id, b.id] });
    const res = await move(ctx, employee, { projectId: b.id });
    expect(res.status).toBe(200);
    expect(res.body.data.projects.current.map((p) => [p.id, p.is_main])).toEqual([
      [b.id, true],
      [ctx.project.id, false],
    ]);
    const rows = await assignments(employee);
    expect(rows.find((r) => r.project_id === ctx.project.id)).toMatchObject({ is_active: 1, main_project: 0, main_project_date_end: "2026-10-20" });
    expect(rows.find((r) => r.project_id === b.id)).toMatchObject({ is_active: 1, main_project: 1, main_project_date_start: TODAY });
    expect((await history(employee)).map((h) => [h.action, h.project_id, h.previous_project_id, h.effective_date]).sort()).toEqual(
      [
        ["MOVED_IN", b.id, ctx.project.id, TODAY],
        ["MOVED_OUT", ctx.project.id, null, TODAY],
      ].sort()
    );
    expect((await periods(employee)).map((p) => [p.project_id, p.date_from, p.date_to])).toEqual([
      [ctx.project.id, "2026-03-01", "2026-10-20"],
      [b.id, TODAY, null],
    ]);
  });

  it("a past effective date; B not yet assigned → it's added as an assignment from that date", async () => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer);
    const employee = await add(ctx);
    expect((await move(ctx, employee, { projectId: b.id, effectiveFrom: "2026-06-01" })).status).toBe(200);
    expect((await assignments(employee)).find((r) => r.project_id === b.id)).toMatchObject({ is_active: 1, start_date: "2026-06-01", main_project: 1 });
    expect((await periods(employee)).map((p) => [p.project_id, p.date_from, p.date_to])).toEqual([
      [ctx.project.id, "2026-03-01", "2026-05-31"],
      [b.id, "2026-06-01", null],
    ]);
  });

  it("for a GENERAL_EMPLOYEE, A's assignment ends the day before with a REMOVED row", async () => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer);
    const employee = await add(ctx, { accessLevel: "GENERAL_EMPLOYEE" });
    expect((await move(ctx, employee, { projectId: b.id, effectiveFrom: "2026-06-01" })).status).toBe(200);
    const rows = await assignments(employee);
    expect(rows.find((r) => r.project_id === ctx.project.id)).toMatchObject({ is_active: 0, end_date: "2026-05-31", main_project: 0 });
    expect((await history(employee)).filter((h) => h.action === "REMOVED").map((h) => [h.project_id, h.effective_date])).toEqual([[ctx.project.id, "2026-05-31"]]);
    expect(rows.filter((r) => r.is_active)).toHaveLength(1);
  });

  it("'which main project on date X?' gives A before the change and B from the effective date; A → B → A makes three periods", async () => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer);
    const employee = await add(ctx);
    await move(ctx, employee, { projectId: b.id, effectiveFrom: "2026-06-01" });
    await move(ctx, employee, { projectId: ctx.project.id, effectiveFrom: "2026-09-01" });
    expect((await periods(employee)).map((p) => [p.project_id, p.date_from, p.date_to])).toEqual([
      [ctx.project.id, "2026-03-01", "2026-05-31"],
      [b.id, "2026-06-01", "2026-08-31"],
      [ctx.project.id, "2026-09-01", null],
    ]);
    expect(await mainProjectOn(employee.id, "2026-05-31")).toBe(ctx.project.id);
    expect(await mainProjectOn(employee.id, "2026-06-01")).toBe(b.id);
    expect(await mainProjectOn(employee.id, "2026-08-31")).toBe(b.id);
    expect(await mainProjectOn(employee.id, "2026-09-01")).toBe(ctx.project.id);
    expect(await mainProjectOn(employee.id, "2026-02-01")).toBeNull();
  });

  it.each(["ON_HOLD", "COMPLETED"])("B %s → 409 PROJECT_NOT_ACTIVE", async (status) => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer, { status });
    const employee = await add(ctx);
    const res = await move(ctx, employee, { projectId: b.id });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("PROJECT_NOT_ACTIVE"));
    expect(res.body.message).toBe("Only active projects can take new employees.");
  });

  it.each([
    ["in the future", "2026-10-22"],
    ["on the current period's start", "2026-03-01"],
    ["before the current period's start", "2026-02-15"],
    ["not a date", "2026-02-30"],
  ])("an effective date %s → effectiveFrom error", async (_label, effectiveFrom) => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer);
    const employee = await add(ctx);
    const res = await move(ctx, employee, { projectId: b.id, effectiveFrom });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ effectiveFrom: "mainProjectEffectiveInvalid" }));
    expect(res.body.errors.effectiveFrom).toBe("Effective date must be after the current main project's start, not in the future and not in a locked period.");
  });

  it.each([
    ["a month lock", async (ctx, fy) => db.PeriodLock.create({ employer_id: ctx.employer.id, financial_year_id: fy.id, period_year: 2026, period_month: 6, module: "ALL", locked_at: new Date() })],
    ["a locked FY", async (ctx, fy) => fy.update({ is_locked: true })],
  ])("an effective date in a locked period (%s) → effectiveFrom error", async (_label, lock) => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer);
    const employee = await add(ctx);
    await lock(ctx, await db.FinancialYear.findOne({ where: { employer_id: ctx.employer.id, year_key: 2026 } }));
    expect((await move(ctx, employee, { projectId: b.id, effectiveFrom: "2026-06-10" })).body).toEqual(validationBody({ effectiveFrom: "mainProjectEffectiveInvalid" }));
  });

  it("a missing project → projectId 'Select a main project'", async () => {
    const ctx = await employeeSetup();
    const employee = await add(ctx);
    expect((await move(ctx, employee, {})).body).toEqual(validationBody({ projectId: "mainProjectRequired" }));
  });

  it("the current main project again → no change", async () => {
    const ctx = await employeeSetup();
    const employee = await add(ctx);
    expect((await move(ctx, employee, { projectId: ctx.project.id })).status).toBe(200);
    expect(await periods(employee)).toHaveLength(1);
    expect(await history(employee)).toEqual([]);
  });

  it("an exited employee → 409 EMPLOYEE_EXITED", async () => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer);
    const employee = await add(ctx);
    await db.Employee.update({ employment_status: "EXITED" }, { where: { id: employee.id } });
    expect((await move(ctx, employee, { projectId: b.id })).body).toEqual(errorBody("EMPLOYEE_EXITED"));
  });

  it("a PROJECT group that no longer matches stays and is flagged as mismatched in the detail", async () => {
    const ctx = await employeeSetup();
    const b = await createProject(ctx.employer);
    const group = await db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: "A team", group_code: "A-TEAM", module_key: "ALL", scope: "PROJECT", project_id: ctx.project.id });
    const employee = await add(ctx, { approvalGroupId: group.id });
    const before = await api.get(`/api/employees/${employee.id}`, ctx.token);
    expect(before.body.data.approval_group).toEqual({ id: group.id, name: "A team", code: "A-TEAM", project_mismatch: false });
    const res = await move(ctx, employee, { projectId: b.id });
    expect(res.body.data.approval_group).toEqual({ id: group.id, name: "A team", code: "A-TEAM", project_mismatch: true });
    expect((await db.EmployeeApprovalRouting.findOne({ where: { employee_id: employee.id } })).approval_group_id).toBe(group.id);
  });

  it("FORBIDDEN without employee:update; staffing → 403; no token → 401; another company's project or employee → 404", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const b = await createProject(ctx.employer);
    const employee = await add(ctx);
    const theirs = await add(other);
    const none = (await loginFor(ctx.employer, "SUB_ADMIN", { employee: { ...NO_FLAGS, can_read: true, can_create: true } })).token;
    expect((await move(ctx, employee, { projectId: b.id }, none)).body).toEqual(errorBody("FORBIDDEN"));
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { employee: { can_update: true } })).token;
    expect((await move(ctx, employee, { projectId: b.id }, staffing)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await move(ctx, employee, { projectId: b.id }, null)).status).toBe(401);
    for (const projectId of [other.project.id, MISSING_ID, "nope"]) {
      expect((await move(ctx, employee, { projectId })).body).toEqual(errorBody("NOT_FOUND"));
    }
    expect((await move(ctx, theirs, { projectId: b.id })).body).toEqual(errorBody("NOT_FOUND"));
    const updater = (await loginFor(ctx.employer, "SUB_ADMIN", { employee: { can_update: true } })).token;
    expect((await move(ctx, employee, { projectId: b.id }, updater)).status).toBe(200);
  });
});
