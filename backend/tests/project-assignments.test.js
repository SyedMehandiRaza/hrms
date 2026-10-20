const {
  db,
  MISSING_ID,
  errorBody,
  validationBody,
  ownerCompany,
  createCompany,
  loginFor,
  createEmployee,
  createProject,
  assign,
  api,
  NO_FLAGS,
} = require("./helpers/api");
const { clock } = require("../src/utils/clock");
const { seedId } = require("../src/utils/seed");

// Project assign / remove API (ticket workforce#05; workforce D13–D15).

const TODAY = "2026-10-20";
beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

// An employee with a login of `accessLevel` (and optionally a role).
const employeeWithLogin = async (employer, accessLevel = "EMPLOYEE", overrides = {}, role = null) => {
  const employee = await createEmployee(employer, overrides);
  await db.HrmsAccount.create({
    user_id: employee.user_id,
    employer_id: employer.id,
    access_level: accessLevel,
    role_id: role ? role.id : null,
    password_setup_required: false,
  });
  return employee;
};

const setup = async (projectOverrides = {}) => {
  const ctx = await ownerCompany();
  const project = await createProject(ctx.employer, projectOverrides);
  return { ...ctx, project };
};
const assignApi = (ctx, employeeIds, projectId = ctx.project.id) => api.post(`/api/projects/${projectId}/employees`, ctx.token, { employeeIds });
const removeApi = (ctx, employeeId, projectId = ctx.project.id) => api.delete(`/api/projects/${projectId}/employees/${employeeId}`, ctx.token);
const rowOf = (employee, project) => db.EmployeeProject.findOne({ where: { employee_id: employee.id, project_id: project.id } });

describe("POST /api/projects/:id/employees", () => {
  it("assigns two employees as a secondary project from today, with ASSIGNED history rows", async () => {
    const ctx = await setup();
    const [a, b] = [await createEmployee(ctx.employer), await createEmployee(ctx.employer)];
    const res = await assignApi(ctx, [a.id, b.id]);
    expect(res.status).toBe(200);
    expect(res.body.data.assigned.sort()).toEqual([a.id, b.id].sort());
    for (const e of [a, b]) {
      const row = await rowOf(e, ctx.project);
      expect(row).toMatchObject({ is_active: true, start_date: TODAY, main_project: false, end_date: null });
      const h = await db.EmployeeProjectHistory.findOne({ where: { employee_id: e.id, project_id: ctx.project.id } });
      expect(h).toMatchObject({ action: "ASSIGNED", effective_date: TODAY, actioned_by: ctx.owner.id, employer_id: ctx.employer.id });
    }
  });

  it("someone already on the project is left as they are (no error, no new row)", async () => {
    const ctx = await setup();
    const a = await createEmployee(ctx.employer);
    await assign(a, ctx.project, { main: true, start: "2026-01-01" });
    const res = await assignApi(ctx, [a.id]);
    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toEqual([]);
    expect(await rowOf(a, ctx.project)).toMatchObject({ main_project: true, start_date: "2026-01-01" });
    expect(await db.EmployeeProjectHistory.count({ where: { employee_id: a.id } })).toBe(0);
  });

  it("someone removed earlier is assigned again from today", async () => {
    const ctx = await setup();
    const a = await createEmployee(ctx.employer);
    const row = await assign(a, ctx.project, { start: "2026-01-01" });
    await row.update({ is_active: false, end_date: "2026-05-01" });
    expect((await assignApi(ctx, [a.id])).body.data.assigned).toEqual([a.id]);
    expect(await row.reload()).toMatchObject({ is_active: true, start_date: TODAY, end_date: null });
  });

  it("an empty list → 400 employeeIds 'Select at least one employee to assign'", async () => {
    const ctx = await setup();
    for (const body of [{ employeeIds: [] }, {}]) {
      const res = await api.post(`/api/projects/${ctx.project.id}/employees`, ctx.token, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ employeeIds: "assignSelectEmployee" }));
    }
  });

  it.each(["ON_HOLD", "COMPLETED"])("a %s project → 409 PROJECT_NOT_ACTIVE", async (status) => {
    const ctx = await setup({ status });
    const res = await assignApi(ctx, [(await createEmployee(ctx.employer)).id]);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("PROJECT_NOT_ACTIVE"));
    expect(res.body.message).toBe("Only active projects can take new employees.");
  });

  it("a GENERAL_EMPLOYEE who already has a project → 409 PROJECT_GENERAL_EMPLOYEE_SINGLE", async () => {
    const ctx = await setup();
    const g = await employeeWithLogin(ctx.employer, "GENERAL_EMPLOYEE");
    await assign(g, await createProject(ctx.employer), { main: true });
    const res = await assignApi(ctx, [g.id]);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("PROJECT_GENERAL_EMPLOYEE_SINGLE"));
    expect(res.body.message).toBe("General employees can belong to only one project.");
  });

  it("a GENERAL_EMPLOYEE whose earlier project ended can be assigned", async () => {
    const ctx = await setup();
    const g = await employeeWithLogin(ctx.employer, "GENERAL_EMPLOYEE");
    const old = await assign(g, await createProject(ctx.employer));
    await old.update({ is_active: false, end_date: "2026-03-01" });
    expect((await assignApi(ctx, [g.id])).body.data.assigned).toEqual([g.id]);
  });

  it.each(["IN_NOTICE", "EXITED"])("an %s employee → 400 employeeIds 'In-notice or exited employees can't be assigned.'; nobody is assigned", async (status) => {
    const ctx = await setup();
    const ok = await createEmployee(ctx.employer);
    const bad = await createEmployee(ctx.employer, { employment_status: status });
    const res = await assignApi(ctx, [ok.id, bad.id]);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ employeeIds: "assignInNoticeOrExited" }));
    expect(await rowOf(ok, ctx.project)).toBeNull();
  });

  it("another company's employee (or an unknown id) → 404 and nobody is assigned", async () => {
    const ctx = await setup();
    const ok = await createEmployee(ctx.employer);
    const other = await createCompany();
    const theirs = await createEmployee(other.employer);
    for (const ids of [[ok.id, theirs.id], [ok.id, MISSING_ID], ["not-a-uuid"]]) {
      const res = await assignApi(ctx, ids);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
    expect(await rowOf(ok, ctx.project)).toBeNull();
  });

  it("another company's project → 404", async () => {
    const ctx = await setup();
    const other = await createCompany();
    const theirs = await createProject(other.employer);
    expect((await assignApi(ctx, [(await createEmployee(ctx.employer)).id], theirs.id)).status).toBe(404);
  });
});

describe("DELETE /api/projects/:id/employees/:employeeId", () => {
  it("ends a secondary assignment today with a REMOVED row", async () => {
    const ctx = await setup();
    const a = await createEmployee(ctx.employer);
    const row = await assign(a, ctx.project);
    const res = await removeApi(ctx, a.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: a.id } });
    expect(await row.reload()).toMatchObject({ is_active: false, end_date: TODAY });
    expect(await db.EmployeeProjectHistory.findOne({ where: { employee_id: a.id } })).toMatchObject({ action: "REMOVED", effective_date: TODAY });
  });

  it("the employee's main project → 409 PROJECT_REMOVE_MAIN", async () => {
    const ctx = await setup();
    const a = await createEmployee(ctx.employer);
    await assign(a, ctx.project, { main: true });
    const res = await removeApi(ctx, a.id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("PROJECT_REMOVE_MAIN"));
    expect(res.body.message).toBe("This is the employee's main project. Change their main project first.");
  });

  it("someone not on the project, an ended assignment, or another company's employee → 404", async () => {
    const ctx = await setup();
    const notOn = await createEmployee(ctx.employer);
    const ended = await createEmployee(ctx.employer);
    await (await assign(ended, ctx.project)).update({ is_active: false });
    const other = await createCompany();
    const theirs = await createEmployee(other.employer);
    for (const id of [notOn.id, ended.id, theirs.id, MISSING_ID, "nope"]) {
      expect((await removeApi(ctx, id)).body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("GET /api/projects/:id/employees (workforce)", () => {
  it("lists ACTIVE and IN_NOTICE employees on the project with role, type, staffing company and status, main first", async () => {
    const ctx = await setup();
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: "Site Engineer" });
    const staffing = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf Manpower", country_id: seedId("country:SA") });
    const main = await employeeWithLogin(ctx.employer, "EMPLOYEE", { full_name: "Zaid Main" }, role);
    const contract = await employeeWithLogin(ctx.employer, "GENERAL_EMPLOYEE", {
      full_name: "Amir Contract",
      employment_type: "CONTRACT",
      employment_status: "IN_NOTICE",
      staffing_company_id: staffing.id,
    });
    const exited = await createEmployee(ctx.employer, { employment_status: "EXITED" });
    await assign(main, ctx.project, { main: true });
    await assign(contract, ctx.project);
    await assign(exited, ctx.project);

    const res = await api.get(`/api/projects/${ctx.project.id}/employees`, ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.items).toEqual([
      {
        id: main.id,
        employee_code: main.employee_code,
        name: "Zaid Main",
        role: "Site Engineer",
        access_level: "EMPLOYEE",
        employment_type: "FULL_TIME",
        staffing_company: null,
        employment_status: "ACTIVE",
        is_main: true,
        start_date: "2026-01-01",
      },
      {
        id: contract.id,
        employee_code: contract.employee_code,
        name: "Amir Contract",
        role: null,
        access_level: "GENERAL_EMPLOYEE",
        employment_type: "CONTRACT",
        staffing_company: "Gulf Manpower",
        employment_status: "IN_NOTICE",
        is_main: false,
        start_date: "2026-01-01",
      },
    ]);
    const inNotice = await api.get(`/api/projects/${ctx.project.id}/employees`, ctx.token, { query: { status: "IN_NOTICE" } });
    expect(inNotice.body.data.items.map((e) => e.id)).toEqual([contract.id]);
    const search = await api.get(`/api/projects/${ctx.project.id}/employees`, ctx.token, { query: { search: "zaid" } });
    expect(search.body.data.items.map((e) => e.id)).toEqual([main.id]);
  });
});

describe("GET /api/projects/:id/assignable-employees", () => {
  it("offers only ACTIVE employees of the company who aren't on the project", async () => {
    const ctx = await setup();
    const free = await createEmployee(ctx.employer, { full_name: "Free Person" });
    const onIt = await createEmployee(ctx.employer);
    await assign(onIt, ctx.project);
    await createEmployee(ctx.employer, { employment_status: "IN_NOTICE" });
    await createEmployee(ctx.employer, { employment_status: "EXITED" });
    const other = await createCompany();
    await createEmployee(other.employer);
    const res = await api.get(`/api/projects/${ctx.project.id}/assignable-employees`, ctx.token);
    expect(res.body.data.items.map((e) => e.id)).toEqual([free.id]);
  });
});

describe("permissions", () => {
  it("no project:update → 403 for assign, remove and the assignable list; project:read may see the workforce", async () => {
    const ctx = await setup();
    const a = await createEmployee(ctx.employer);
    await assign(a, ctx.project);
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", { project: { can_read: true } });
    expect((await api.post(`/api/projects/${ctx.project.id}/employees`, token, { employeeIds: [a.id] })).body).toEqual(errorBody("FORBIDDEN"));
    expect((await api.delete(`/api/projects/${ctx.project.id}/employees/${a.id}`, token)).status).toBe(403);
    expect((await api.get(`/api/projects/${ctx.project.id}/assignable-employees`, token)).status).toBe(403);
    expect((await api.get(`/api/projects/${ctx.project.id}/employees`, token)).status).toBe(200);
  });

  it("no project flags at all → 403 on the workforce list; no token → 401", async () => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, "EMPLOYEE", { project: NO_FLAGS });
    expect((await api.get(`/api/projects/${ctx.project.id}/employees`, token)).status).toBe(403);
    expect((await api.get(`/api/projects/${ctx.project.id}/employees`, null)).status).toBe(401);
  });

  it("a SUB_ADMIN with project:update assigns and removes", async () => {
    const ctx = await setup();
    const a = await createEmployee(ctx.employer);
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", { project: { can_read: true, can_update: true } });
    expect((await api.post(`/api/projects/${ctx.project.id}/employees`, token, { employeeIds: [a.id] })).status).toBe(200);
    expect((await api.delete(`/api/projects/${ctx.project.id}/employees/${a.id}`, token)).status).toBe(200);
  });

  it("a staffing-company login → 403", async () => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, "STAFFING_COMPANY", { project: { can_read: true, can_update: true } });
    expect((await api.get(`/api/projects/${ctx.project.id}/employees`, token)).status).toBe(403);
  });
});
