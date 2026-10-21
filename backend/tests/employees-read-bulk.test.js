const bcrypt = require("bcrypt");
const { db, PASSWORD, MISSING_ID, errorBody, validationBody, loginAs, loginFor, createRole, createProject, createFinancialYear, api, NO_FLAGS } = require("./helpers/api");
const { employeeSetup, createLeavePolicy, createdEmployee } = require("./helpers/employees");
const { clock } = require("../src/utils/clock");
const mailer = require("../src/services/mailer");

// Employee list, detail, bulk (de)activate, resend login (ticket workforce#14a; workforce D47,
// D56, D56a, D57).

const TODAY = "2026-10-21";

beforeEach(() => {
  jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`));
  mailer.clear();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const READER = { employee: { can_read: true } };
const UPDATER = { employee: { can_update: true } };

let phoneNo = 1000;
const nextPhone = () => `05012${String((phoneNo += 1)).padStart(5, "0")}`;
const add = (ctx, overrides = {}) => createdEmployee(ctx, { phone: nextPhone(), ...overrides });

// A login for an employee created through the API, as if they had set their own password.
const loginOf = async (employeeId) => {
  const employee = await db.Employee.findByPk(employeeId);
  const user = await db.User.findByPk(employee.user_id);
  await db.User.update({ password: await bcrypt.hash(PASSWORD, 4) }, { where: { id: user.id } });
  await db.HrmsAccount.update({ password_setup_required: false, password_setup_token_hash: null }, { where: { user_id: user.id } });
  return loginAs(user.email);
};

const accountOf = async (employeeId) => {
  const employee = await db.Employee.findByPk(employeeId);
  return db.HrmsAccount.findOne({ where: { user_id: employee.user_id, employer_id: employee.employer_id } });
};

describe("GET /api/employees", () => {
  it("lists the company's employees with their role, type, main project and staffing company, paged", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    await add(other);
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: "Site Engineer" });
    const staffing = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf Manpower", code: "GM-1" });
    const a = await add(ctx, { name: "Ahmed Ali", roleId: role.id });
    const b = await add(ctx, { name: "Bilal Khan", employmentType: "CONTRACT", staffingCompanyId: staffing.id, salaryMode: "HOURLY", hourlyRate: 20, components: [] });
    const res = await api.get("/api/employees", ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 2, page: 1, limit: 20 });
    const [first, second] = res.body.data.items;
    expect(first).toEqual({
      id: a.id,
      employee_code: "EMP-0001",
      country_emp_id: expect.any(String),
      name: "Ahmed Ali",
      email: a.email,
      employment_status: "ACTIVE",
      account_status: "ACTIVE",
      access_level: "EMPLOYEE",
      role: { id: role.id, name: "Site Engineer" },
      employment_type: "FULL_TIME",
      main_project: { id: ctx.project.id, name: ctx.project.project_name, code: ctx.project.project_code },
      staffing_company: null,
    });
    expect(second).toMatchObject({ id: b.id, employee_code: "EMP-0002", role: null, employment_type: "CONTRACT", staffing_company: { id: staffing.id, name: "Gulf Manpower" } });
    const page2 = await api.get("/api/employees", ctx.token, { query: { page: 2, limit: 1 } });
    expect(page2.body.data.items.map((i) => i.id)).toEqual([b.id]);
  });

  it("filters by project (main or secondary), type, role, status and search (name, Employee ID, ID number, email)", async () => {
    const ctx = await employeeSetup();
    const second = await createProject(ctx.employer);
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: "Foreman" });
    const a = await add(ctx, { name: "Ahmed Ali", country_emp_id: "IQ-111", email: "ahmed@acme.test", projectIds: [ctx.project.id, second.id] });
    const b = await add(ctx, { name: "Bilal Khan", roleId: role.id, employmentType: "CONTRACT", salaryMode: "MONTHLY_HOURLY", workingHours: 8 });
    const c = await add(ctx, { name: "Chand Bibi" });
    await db.Employee.update({ employment_status: "IN_NOTICE" }, { where: { id: c.id } });
    const ids = async (query) => (await api.get("/api/employees", ctx.token, { query })).body.data.items.map((i) => i.id);
    expect(await ids({ projectId: second.id })).toEqual([a.id]);
    expect(await ids({ projectId: ctx.project.id })).toEqual([a.id, b.id, c.id]);
    expect(await ids({ employmentType: "CONTRACT" })).toEqual([b.id]);
    expect(await ids({ roleId: role.id })).toEqual([b.id]);
    expect(await ids({ status: "IN_NOTICE" })).toEqual([c.id]);
    expect(await ids({ status: "ACTIVE" })).toEqual([a.id, b.id]);
    expect(await ids({ search: "bilal" })).toEqual([b.id]);
    expect(await ids({ search: "EMP-0003" })).toEqual([c.id]);
    expect(await ids({ search: "iq-111" })).toEqual([a.id]);
    expect(await ids({ search: "ahmed@acme" })).toEqual([a.id]);
    expect(await ids({ search: "nobody" })).toEqual([]);
  });

  it.each([
    [{ status: "GONE" }, "status"],
    [{ employmentType: "PART" }, "employmentType"],
    [{ limit: 101 }, "limit"],
    [{ page: 0 }, "page"],
  ])("a bad filter %j → 400 on %s", async (query, field) => {
    const ctx = await employeeSetup();
    expect((await api.get("/api/employees", ctx.token, { query })).body).toEqual(validationBody({ [field]: "VALIDATION_FAILED" }));
  });
});

describe("GET /api/employees/:id", () => {
  it("returns overview, projects (current, past, history), shift, leave policies, salary and approval group", async () => {
    const ctx = await employeeSetup();
    const second = await createProject(ctx.employer);
    const shift = await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Day", start_time: "08:00:00", end_time: "17:00:00" });
    const group = await db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: "Site approvals", group_code: "SITE", module_key: "ALL" });
    const data = await add(ctx, { name: "Ahmed Ali", projectIds: [ctx.project.id, second.id], shiftId: shift.id, approvalGroupId: group.id, joiningDate: "2026-09-01" });
    // Taken off the second project later.
    await db.EmployeeProject.update({ is_active: false, end_date: "2026-10-10" }, { where: { employee_id: data.id, project_id: second.id } });
    await db.EmployeeProjectHistory.create({ employer_id: ctx.employer.id, employee_id: data.id, project_id: second.id, action: "REMOVED", effective_date: "2026-10-10", actioned_at: new Date() });

    const res = await api.get(`/api/employees/${data.id}`, ctx.token);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.overview).toMatchObject({
      id: data.id,
      employee_code: "EMP-0001",
      name: "Ahmed Ali",
      email: data.email,
      phone: data.phone,
      phoneCountry: "SA",
      nationality: { id: expect.any(String), name: "India" },
      residence_country: { id: expect.any(String), name: "Saudi Arabia" },
      residence_city: null,
      employment_type: "FULL_TIME",
      employment_status: "ACTIVE",
      joining_date: "2026-09-01",
      access_level: "EMPLOYEE",
      account_status: "ACTIVE",
      role: null,
      department: null,
      designation: null,
      staffing_company: null,
      overtime_rate: 1.5,
    });
    expect(d.projects.current).toEqual([{ id: ctx.project.id, name: ctx.project.project_name, code: ctx.project.project_code, is_main: true, start_date: "2026-09-01", end_date: null }]);
    expect(d.projects.past).toEqual([{ id: second.id, name: second.project_name, code: second.project_code, is_main: false, start_date: "2026-09-01", end_date: "2026-10-10" }]);
    // Newest first.
    const history = d.projects.history.map((h) => [h.project.id, h.action, h.effective_date]);
    expect(history[0]).toEqual([second.id, "REMOVED", "2026-10-10"]);
    expect(history.slice(1).sort()).toEqual(
      [
        [ctx.project.id, "ASSIGNED", "2026-09-01"],
        [second.id, "ASSIGNED", "2026-09-01"],
      ].sort()
    );
    expect(d.shift).toEqual({ id: shift.id, name: "Day" });
    expect(d.leave_policies).toEqual([
      { id: ctx.policy.id, name: ctx.policy.policy_name, leave_type: { id: ctx.policy.leave_type_id, name: expect.any(String) }, effective_from: "2026-09-01", effective_to: null, is_active: true },
    ]);
    expect(d.salary).toMatchObject({ currency: "SAR", mode: "MONTHLY_FIXED", working_hours: null, min_hours: null, effective_from: "2026-09-01" });
    expect(d.salary.components.map((c) => [c.component.code, c.calculation_type, c.amount])).toEqual([
      ["BASIC", "FIXED", 5000],
      ["HOUSING", "FIXED", 1250],
      ["TRANSPORT", "FIXED", 500],
    ]);
    expect(d.approval_group).toEqual({ id: group.id, name: "Site approvals", code: "SITE", project_mismatch: false });
  });

  it("no approval group → approval_group null; names in Arabic with Accept-Language: ar", async () => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    const res = await api.get(`/api/employees/${data.id}`, ctx.token, { lang: "ar" });
    expect(res.body.data.approval_group).toBeNull();
    expect(res.body.data.overview.nationality.name).toBe("الهند");
  });

  it("another company's, unknown or malformed id → 404", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const theirs = await add(other);
    for (const id of [theirs.id, MISSING_ID, "nope"]) {
      expect((await api.get(`/api/employees/${id}`, ctx.token)).body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("Employee panel (D57)", () => {
  it("an EMPLOYEE-panel login reads its own profile (no employee:read needed) but not another's, and can't list", async () => {
    const ctx = await employeeSetup();
    for (const accessLevel of ["EMPLOYEE", "GENERAL_EMPLOYEE"]) {
      const me = await add(ctx, { accessLevel });
      const other = await add(ctx);
      const token = await loginOf(me.id);
      expect((await api.get(`/api/employees/${me.id}`, token)).status).toBe(200);
      expect((await api.get(`/api/employees/${other.id}`, token)).body).toEqual(errorBody("FORBIDDEN"));
      expect((await api.get("/api/employees", token)).body).toEqual(errorBody("FORBIDDEN"));
    }
  });

  // The Employee panel's My Profile doesn't know its employee id (ticket workforce#31).
  it("GET /employees/me → the caller's own detail; a login without an employee record → 404", async () => {
    const ctx = await employeeSetup();
    const me = await add(ctx, { accessLevel: "EMPLOYEE", name: "Mona Self" });
    const token = await loginOf(me.id);
    const res = await api.get("/api/employees/me", token);
    expect(res.status).toBe(200);
    expect(res.body.data.overview).toMatchObject({ id: me.id, name: "Mona Self" });
    expect((await api.get("/api/employees/me", ctx.token)).body).toEqual(errorBody("NOT_FOUND"));
  });

  it("even with employee:read, an EMPLOYEE-panel login sees only itself", async () => {
    const ctx = await employeeSetup();
    const role = await createRole(ctx.employer, READER);
    const me = await add(ctx, { roleId: role.id });
    const other = await add(ctx);
    const token = await loginOf(me.id);
    expect((await api.get(`/api/employees/${other.id}`, token)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await api.get("/api/employees", token)).body).toEqual(errorBody("FORBIDDEN"));
  });
});

describe("POST /api/employees/bulk-status", () => {
  it("deactivate → accounts SUSPENDED and their sessions revoked; activate → ACTIVE", async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx);
    const b = await add(ctx);
    const token = await loginOf(a.id);
    expect((await api.get(`/api/employees/${a.id}`, token)).status).toBe(200);
    const res = await api.post("/api/employees/bulk-status", ctx.token, { employeeIds: [a.id, b.id], status: "SUSPENDED" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 2 });
    expect((await accountOf(a.id)).status).toBe("SUSPENDED");
    expect((await accountOf(b.id)).status).toBe("SUSPENDED");
    const account = await accountOf(a.id);
    expect(await db.HrmsSession.count({ where: { hrms_account_id: account.id, status: "ACTIVE" } })).toBe(0);
    expect((await api.get(`/api/employees/${a.id}`, token)).status).toBe(401);

    expect((await api.post("/api/employees/bulk-status", ctx.token, { employeeIds: [a.id], status: "ACTIVE" })).body.data).toEqual({ updated: 1 });
    expect((await accountOf(a.id)).status).toBe("ACTIVE");
    expect((await accountOf(b.id)).status).toBe("SUSPENDED");
  });

  it("IN_NOTICE employees can be switched like any other", async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx);
    await db.Employee.update({ employment_status: "IN_NOTICE" }, { where: { id: a.id } });
    expect((await api.post("/api/employees/bulk-status", ctx.token, { employeeIds: [a.id], status: "SUSPENDED" })).status).toBe(200);
  });

  it("a batch with an exited employee → 409 EMPLOYEE_EXITED and no account in the batch changes", async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx);
    const gone = await add(ctx);
    await db.Employee.update({ employment_status: "EXITED" }, { where: { id: gone.id } });
    const res = await api.post("/api/employees/bulk-status", ctx.token, { employeeIds: [a.id, gone.id], status: "SUSPENDED" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("EMPLOYEE_EXITED"));
    expect(res.body.message).toBe("This employee has exited. Use Rehire.");
    expect((await accountOf(a.id)).status).toBe("ACTIVE");
  });

  it("another company's or an unknown id in the batch → 404 and nothing changes", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const a = await add(ctx);
    const theirs = await add(other);
    for (const id of [theirs.id, MISSING_ID]) {
      expect((await api.post("/api/employees/bulk-status", ctx.token, { employeeIds: [a.id, id], status: "SUSPENDED" })).body).toEqual(errorBody("NOT_FOUND"));
    }
    expect((await accountOf(a.id)).status).toBe("ACTIVE");
    expect((await accountOf(theirs.id)).status).toBe("ACTIVE");
  });

  it("the owner's own employee record is protected → 403 ACCOUNT_OWNER_PROTECTED", async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx);
    const ownerEmployee = await db.Employee.create({ user_id: ctx.owner.id, employer_id: ctx.employer.id, employee_code: "EMP-9000", country_emp_id: "OWN-1", full_name: "Owner Person" });
    const res = await api.post("/api/employees/bulk-status", ctx.token, { employeeIds: [a.id, ownerEmployee.id], status: "SUSPENDED" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("ACCOUNT_OWNER_PROTECTED"));
    expect((await accountOf(a.id)).status).toBe("ACTIVE");
  });

  it.each([
    [{ status: "SUSPENDED" }, "employeeIds"],
    [{ employeeIds: [], status: "SUSPENDED" }, "employeeIds"],
    [{ employeeIds: "x", status: "SUSPENDED" }, "employeeIds"],
    [{ employeeIds: [MISSING_ID] }, "status"],
    [{ employeeIds: [MISSING_ID], status: "EXITED" }, "status"],
  ])("a malformed body %j → 400 on %s", async (body, field) => {
    const ctx = await employeeSetup();
    expect((await api.post("/api/employees/bulk-status", ctx.token, body)).body).toEqual(validationBody({ [field]: "VALIDATION_FAILED" }));
  });
});

describe("POST /api/employees/:id/resend-login", () => {
  it("sends a new temporary password and setup link; the old link no longer works", async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx);
    const firstLink = mailer.outbox().find((m) => m.to === a.email).text.match(/reset-password\?setup=(\S+)/)[1];
    mailer.clear();
    const res = await api.post(`/api/employees/${a.id}/resend-login`, ctx.token, {});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ temporary_password: true });
    const mails = mailer.outbox().filter((m) => m.to === a.email);
    expect(mails.map((m) => m.template)).toEqual(["welcome-temp-password"]);
    const newLink = mails[0].text.match(/reset-password\?setup=(\S+)/)[1];
    expect(newLink).not.toBe(firstLink);
    const old = await api.post("/api/auth/setup-password", null, { token: decodeURIComponent(firstLink), newPassword: "Brand#New123", confirmPassword: "Brand#New123" });
    expect(old.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));
  });

  it("an exited employee → 409 EMPLOYEE_EXITED and no email", async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx);
    await db.Employee.update({ employment_status: "EXITED" }, { where: { id: a.id } });
    mailer.clear();
    expect((await api.post(`/api/employees/${a.id}/resend-login`, ctx.token, {})).body).toEqual(errorBody("EMPLOYEE_EXITED"));
    expect(mailer.outbox()).toEqual([]);
  });

  it("another company's or unknown employee → 404", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const theirs = await add(other);
    for (const id of [theirs.id, MISSING_ID, "nope"]) {
      expect((await api.post(`/api/employees/${id}/resend-login`, ctx.token, {})).body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("permissions", () => {
  it("list/detail need employee:read; bulk and resend need employee:update; staffing → 403; no token → 401", async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx);
    const calls = (token) => ({
      list: api.get("/api/employees", token),
      detail: api.get(`/api/employees/${a.id}`, token),
      bulk: api.post("/api/employees/bulk-status", token, { employeeIds: [a.id], status: "ACTIVE" }),
      resend: api.post(`/api/employees/${a.id}/resend-login`, token, {}),
    });
    const statuses = async (token) => {
      const c = calls(token);
      const out = {};
      for (const [key, req] of Object.entries(c)) out[key] = (await req).status;
      return out;
    };
    const none = (await loginFor(ctx.employer, "SUB_ADMIN", { employee: { ...NO_FLAGS, can_create: true, can_delete: true } })).token;
    expect(await statuses(none)).toEqual({ list: 403, detail: 403, bulk: 403, resend: 403 });
    const reader = (await loginFor(ctx.employer, "SUB_ADMIN", READER)).token;
    expect(await statuses(reader)).toEqual({ list: 200, detail: 200, bulk: 403, resend: 403 });
    const updater = (await loginFor(ctx.employer, "SUB_ADMIN", UPDATER)).token;
    expect(await statuses(updater)).toEqual({ list: 403, detail: 403, bulk: 200, resend: 200 });
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { employee: { can_read: true, can_update: true } })).token;
    expect(await statuses(staffing)).toEqual({ list: 403, detail: 403, bulk: 403, resend: 403 });
    expect(await statuses(null)).toEqual({ list: 401, detail: 401, bulk: 401, resend: 401 });
    expect((await api.get("/api/employees", none)).body).toEqual(errorBody("FORBIDDEN"));
  });

  it("leave policy and FY fixtures don't leak into other companies' lists", async () => {
    const ctx = await employeeSetup();
    await createFinancialYear(ctx.employer, 2027);
    await createLeavePolicy(ctx.employer);
    const other = await employeeSetup();
    await add(other);
    expect((await api.get("/api/employees", ctx.token)).body.data.items).toEqual([]);
  });
});
