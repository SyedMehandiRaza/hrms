const h = require("./helpers/contracts");

const { db, api, errorBody, createCompany, hrLogin, ownerToken, createEmployee, createStaffingCompany, createProject, assignProject } = h;

// Recipient lookup for the send wizard (ticket contract-studio#06; plan decisions 20, 41;
// ADR 0008). Read-only toward employees, accounts and staffing companies.

afterAll(() => db.sequelize.close());

const lookup = (token, query) => api.get("/contract-recipients", token, { query });
const ids = (res) => res.body.data.items.map((i) => i.id);
const itemOf = (res, id) => res.body.data.items.find((i) => i.id === id);

describe("GET /contract-recipients — employees", () => {
  let company;
  let token;
  let projectA;
  let projectB;
  let staffing;
  let rows;

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
    const { employer } = company;
    projectA = await createProject(employer, { project_name: "King Salman Park" });
    projectB = await createProject(employer, { project_name: "Jeddah Tower" });
    ({ company: staffing } = await createStaffingCompany(employer, { name: "Gulf Manpower" }));

    const make = (overrides, opts) => createEmployee(employer, overrides, opts).then((r) => r.employee);
    rows = {
      sara: await make({ full_name: "Sara Khan", country_emp_id: "2400000001" }),
      omar: await make({ full_name: "Omar Farooq", country_emp_id: "2400000002", staffing_company_id: staffing.id }),
      exited: await make({ full_name: "Exited Person", employment_status: "EXITED" }),
      deleted: await make({ full_name: "Deleted Person" }),
      noAccount: await make({ full_name: "No Account" }, { account: false }),
      endedAccount: await make({ full_name: "Ended Account" }, { accountStatus: "INACTIVE" }),
      suspended: await make({ full_name: "Suspended Account" }, { accountStatus: "SUSPENDED" }),
      inNotice: await make({ full_name: "In Notice", employment_status: "IN_NOTICE" }),
      secondary: await make({ full_name: "Secondary On A" }),
      endedOnA: await make({ full_name: "Ended On A" }),
    };
    await rows.deleted.destroy();
    await assignProject(employer, rows.sara, projectA, { main_project: true, main_project_date_start: "2026-01-01" });
    await assignProject(employer, rows.omar, projectB, { main_project: true, main_project_date_start: "2026-01-01" });
    await assignProject(employer, rows.secondary, projectB, { main_project: true, main_project_date_start: "2026-02-01" });
    await assignProject(employer, rows.secondary, projectA, { main_project: false });
    await assignProject(employer, rows.endedOnA, projectA, { main_project: false, is_active: false });
  });

  it("lists employees with id, name, code, main project, staffing company and status, paginated", async () => {
    const res = await lookup(token, { audience: "EMPLOYEE", limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ page: 1, limit: 100 });
    expect(res.body.data.total).toBe(10);
    expect(itemOf(res, rows.sara.id)).toEqual({
      id: rows.sara.id,
      name: "Sara Khan",
      code: "2400000001",
      project: { id: projectA.id, name: "King Salman Park" },
      staffingCompany: null,
      status: "ACTIVE",
    });
    expect(itemOf(res, rows.omar.id)).toMatchObject({
      project: { id: projectB.id, name: "Jeddah Tower" },
      staffingCompany: { id: staffing.id, name: "Gulf Manpower" },
    });
  });

  it("paginates", async () => {
    const page1 = await lookup(token, { audience: "EMPLOYEE", limit: 4, page: 1 });
    const page3 = await lookup(token, { audience: "EMPLOYEE", limit: 4, page: 3 });
    expect(page1.body.data.items).toHaveLength(4);
    expect(page3.body.data.items).toHaveLength(2);
    expect(page1.body.data.total).toBe(10);
  });

  it("filters by project: every active assignment, main or not; ended assignments aren't", async () => {
    const res = await lookup(token, { audience: "EMPLOYEE", projectId: projectA.id });
    expect(ids(res).sort()).toEqual([rows.sara.id, rows.secondary.id].sort());
    // The project column still shows the main project.
    expect(itemOf(res, rows.secondary.id).project).toEqual({ id: projectB.id, name: "Jeddah Tower" });
  });

  it("filters by staffing company", async () => {
    const res = await lookup(token, { audience: "EMPLOYEE", staffingCompanyId: staffing.id });
    expect(ids(res)).toEqual([rows.omar.id]);
  });

  it("searches by name or code", async () => {
    expect(ids(await lookup(token, { audience: "EMPLOYEE", q: "omar" }))).toEqual([rows.omar.id]);
    expect(ids(await lookup(token, { audience: "EMPLOYEE", q: "2400000001" }))).toEqual([rows.sara.id]);
  });

  it("shows a blank project when there's no active main project", async () => {
    const res = await lookup(token, { audience: "EMPLOYEE", q: "In Notice" });
    expect(itemOf(res, rows.inNotice.id).project).toBeNull();
  });

  it("lists exited, deleted, account-less and ended-account employees as inactive, not hidden", async () => {
    const res = await lookup(token, { audience: "EMPLOYEE", limit: 100 });
    for (const key of ["exited", "deleted", "noAccount", "endedAccount"]) {
      expect(itemOf(res, rows[key].id)).toMatchObject({ status: "INACTIVE" });
    }
  });

  it("keeps suspended accounts and IN_NOTICE employees active", async () => {
    const res = await lookup(token, { audience: "EMPLOYEE", limit: 100 });
    expect(itemOf(res, rows.suspended.id).status).toBe("ACTIVE");
    expect(itemOf(res, rows.inNotice.id).status).toBe("ACTIVE");
  });

  it("uses the latest main-project start when two main projects are active", async () => {
    const { employee } = await createEmployee(company.employer, { full_name: "Two Mains" });
    await assignProject(company.employer, employee, projectA, { main_project: true, main_project_date_start: "2026-01-01" });
    await assignProject(company.employer, employee, projectB, { main_project: true, main_project_date_start: "2026-05-01" });
    const res = await lookup(token, { audience: "EMPLOYEE", q: "Two Mains" });
    expect(itemOf(res, employee.id).project.id).toBe(projectB.id);
    await employee.destroy({ force: true });
  });

  it("returns only the caller's company", async () => {
    const other = await createCompany("Other Co");
    const { employee } = await createEmployee(other.employer, { full_name: "Sara Khan" });
    const res = await lookup(token, { audience: "EMPLOYEE", q: "Sara Khan" });
    expect(ids(res)).toEqual([rows.sara.id]);
    expect(ids(res)).not.toContain(employee.id);
  });

  it("changes no employee, account or staffing-company row", async () => {
    const snapshot = async () => ({
      employees: await db.Employee.findAll({ where: { employer_id: company.employer.id }, paranoid: false, raw: true }),
      accounts: await db.HrmsAccount.findAll({ where: { employer_id: company.employer.id }, paranoid: false, raw: true }),
      staffing: await db.StaffingCompany.findAll({ where: { employer_id: company.employer.id }, paranoid: false, raw: true }),
    });
    const before = await snapshot();
    await lookup(token, { audience: "EMPLOYEE", limit: 100 });
    await lookup(token, { audience: "STAFFING_COMPANY", limit: 100 });
    expect(await snapshot()).toEqual(before);
  });
});

describe("GET /contract-recipients — staffing companies", () => {
  let company;
  let token;
  let rows;

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
    const make = (overrides, opts) => createStaffingCompany(company.employer, overrides, opts).then((r) => r.company);
    rows = {
      gulf: await make({ name: "Gulf Manpower", code: "GULF" }),
      desert: await make({ name: "Desert Staffing", code: "DS-01" }),
      inactive: await make({ name: "Inactive Co", status: "INACTIVE" }),
      deleted: await make({ name: "Deleted Co" }),
      noLogin: await make({ name: "No Login Co" }, { login: false }),
      endedLogin: await make({ name: "Ended Login Co" }, { accountStatus: "INACTIVE" }),
      suspended: await make({ name: "Suspended Login Co" }, { accountStatus: "SUSPENDED" }),
    };
    await rows.deleted.destroy();
  });

  it("lists id, name, code and status", async () => {
    const res = await lookup(token, { audience: "STAFFING_COMPANY", limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(7);
    expect(itemOf(res, rows.gulf.id)).toEqual({ id: rows.gulf.id, name: "Gulf Manpower", code: "GULF", status: "ACTIVE" });
  });

  it("searches by name or code", async () => {
    expect(ids(await lookup(token, { audience: "STAFFING_COMPANY", q: "desert" }))).toEqual([rows.desert.id]);
    expect(ids(await lookup(token, { audience: "STAFFING_COMPANY", q: "GULF" }))).toEqual([rows.gulf.id]);
  });

  it("marks inactive, deleted, login-less and ended-login companies inactive; suspended login stays active", async () => {
    const res = await lookup(token, { audience: "STAFFING_COMPANY", limit: 100 });
    for (const key of ["inactive", "deleted", "noLogin", "endedLogin"]) {
      expect(itemOf(res, rows[key].id).status).toBe("INACTIVE");
    }
    expect(itemOf(res, rows.suspended.id).status).toBe("ACTIVE");
  });
});

describe("GET /contract-recipients — audience, auth and permissions", () => {
  let company;

  beforeAll(async () => {
    company = await createCompany();
  });

  it.each(["VENDOR", "CLIENT", "COLLABORATING_COMPANY", "NOPE", undefined])("audience %s → 400 CONTRACT_AUDIENCE_UNSUPPORTED", async (audience) => {
    const token = await ownerToken(company);
    const res = await lookup(token, audience ? { audience } : {});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("CONTRACT_AUDIENCE_UNSUPPORTED"));
  });

  it("answers in Arabic", async () => {
    const token = await ownerToken(company);
    const res = await api.get("/contract-recipients", token, { query: { audience: "VENDOR" }, lang: "ar" });
    expect(res.body).toEqual(errorBody("CONTRACT_AUDIENCE_UNSUPPORTED", "ar"));
  });

  it("401 without a token", async () => {
    const res = await lookup(undefined, { audience: "EMPLOYEE" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("allows a sub-admin with contract:create", async () => {
    const { token } = await hrLogin(company.employer, { can_create: true });
    expect((await lookup(token, { audience: "EMPLOYEE" })).status).toBe(200);
  });

  it.each([
    ["no role", undefined],
    ["read, update and delete only", { can_read: true, can_update: true, can_delete: true }],
  ])("403 for a sub-admin with %s", async (_, flags) => {
    const { token } = await hrLogin(company.employer, flags);
    const res = await lookup(token, { audience: "EMPLOYEE" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("403 for an employee and for a staffing company", async () => {
    const { user: empUser } = await createEmployee(company.employer);
    const { user: staffUser } = await createStaffingCompany(company.employer);
    for (const user of [empUser, staffUser]) {
      const res = await lookup(await h.loginAs(user.email), { audience: "EMPLOYEE" });
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    }
  });

  it("403 for a staffing login even with a full contract role", async () => {
    const role = await h.createRole(company.employer, h.ALL_FLAGS);
    const { user } = await createStaffingCompany(company.employer);
    await db.HrmsAccount.update({ role_id: role.id }, { where: { user_id: user.id } });
    const res = await lookup(await h.loginAs(user.email), { audience: "EMPLOYEE" });
    expect(res.status).toBe(403);
  });

  it("400 VALIDATION_FAILED for a bad project id or page", async () => {
    const token = await ownerToken(company);
    const res = await lookup(token, { audience: "EMPLOYEE", projectId: "not-a-uuid", page: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.errors).sort()).toEqual(["page", "projectId"]);
  });
});
