const bcrypt = require("bcrypt");
const {
  db,
  SA,
  MISSING_ID,
  short,
  uniqueEmail,
  errorBody,
  validationBody,
  loginFor,
  createEmployee,
  createProject,
  api,
  NO_FLAGS,
} = require("./helpers/api");
const { clock } = require("../src/utils/clock");
const { seedId } = require("../src/utils/seed");
const mailer = require("../src/services/mailer");
const { IN, employeeSetup, createEmployeeVia, createdEmployee } = require("./helpers/employees");

// Create employee core (ticket workforce#13a; workforce D18, D45–D51, D53, ADRs 0002, 0003;
// countries-cities-phones D12–D19). Leave, shift and salary at create are 13b.

const TODAY = "2026-10-21";
const AE = seedId("country:AE");
const RIYADH = seedId("city:Riyadh");

beforeEach(() => {
  jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`));
  mailer.clear();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const CREATOR = { employee: { can_create: true } };

const setup = employeeSetup;
const create = createEmployeeVia;
const created = createdEmployee;

const approvalGroup = (employer, overrides = {}) =>
  db.ApprovalGroup.create({
    employer_id: employer.id,
    group_name: `Group ${short()}`,
    group_code: `G-${short()}`,
    module_key: "ALL",
    total_levels: 1,
    ...overrides,
  });

const countRows = async (employer) => ({
  employees: await db.Employee.count({ where: { employer_id: employer.id } }),
  accounts: await db.HrmsAccount.count({ where: { employer_id: employer.id } }),
  assignments: await db.EmployeeProject.count({ where: { employer_id: employer.id } }),
  history: await db.EmployeeProjectHistory.count({ where: { employer_id: employer.id } }),
  periods: await db.EmployeeMainProjectPeriod.count({ where: { employer_id: employer.id } }),
  routing: await db.EmployeeApprovalRouting.count({ where: { employer_id: employer.id } }),
});

describe("POST /api/employees — success", () => {
  it("creates EMP-0001 then EMP-0002 with user, account, assignments + ASSIGNED rows, main period and routing", async () => {
    const ctx = await setup();
    const second = await createProject(ctx.employer, { start_date: "2026-02-01" });
    const group = await approvalGroup(ctx.employer);
    const creator = await loginFor(ctx.employer, "SUB_ADMIN", CREATOR);
    const res = await create(
      ctx,
      { projectIds: [ctx.project.id, second.id], mainProjectId: ctx.project.id, approvalGroupId: group.id, joiningDate: "2026-10-01" },
      creator.token
    );
    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data).toMatchObject({
      employee_code: "EMP-0001",
      name: "Ahmed Ali",
      phone: "+966501234567",
      phoneCountry: "SA",
      access_level: "EMPLOYEE",
      employment_type: "FULL_TIME",
      employment_status: "ACTIVE",
      joining_date: "2026-10-01",
      main_project_id: ctx.project.id,
      approval_group_id: group.id,
    });

    const employee = await db.Employee.findByPk(data.id);
    expect(employee).toMatchObject({ employer_id: ctx.employer.id, employee_code: "EMP-0001", date_of_joining: "2026-10-01", nationality_country_id: IN, residence_country_id: SA, residence_city_id: null });
    const user = await db.User.findByPk(employee.user_id);
    expect(user).toMatchObject({ name: "Ahmed Ali", phone_number: "+966501234567", phone_country: "SA" });
    const account = await db.HrmsAccount.findOne({ where: { user_id: user.id, employer_id: ctx.employer.id } });
    expect(account).toMatchObject({ access_level: "EMPLOYEE", role_id: null, status: "ACTIVE", invited_by: creator.person.id, created_by: creator.person.id });

    const assignments = await db.EmployeeProject.findAll({ where: { employee_id: employee.id }, raw: true });
    expect(assignments.map((a) => [a.project_id, Boolean(a.main_project), a.start_date, a.main_project_date_start]).sort()).toEqual(
      [
        [ctx.project.id, true, "2026-10-01", "2026-10-01"],
        [second.id, false, "2026-10-01", null],
      ].sort()
    );
    const history = await db.EmployeeProjectHistory.findAll({ where: { employee_id: employee.id }, raw: true });
    expect(history.map((h) => [h.project_id, h.action, h.effective_date, h.actioned_by]).sort()).toEqual(
      [
        [ctx.project.id, "ASSIGNED", "2026-10-01", creator.person.id],
        [second.id, "ASSIGNED", "2026-10-01", creator.person.id],
      ].sort()
    );
    const periods = await db.EmployeeMainProjectPeriod.findAll({ where: { employee_id: employee.id }, raw: true });
    expect(periods).toEqual([expect.objectContaining({ project_id: ctx.project.id, date_from: "2026-10-01", date_to: null })]);
    const routing = await db.EmployeeApprovalRouting.findAll({ where: { employee_id: employee.id }, raw: true });
    expect(routing).toEqual([expect.objectContaining({ module_key: "ALL", approval_group_id: group.id })]);

    const next = await created(ctx, { phone: "0501234568", approvalGroupId: group.id });
    expect(next.employee_code).toBe("EMP-0002");
  });

  it("the Employee ID continues after the highest existing number and is never reused", async () => {
    const ctx = await setup();
    const first = await created(ctx);
    await db.Employee.destroy({ where: { id: first.id } });
    expect((await created(ctx, { phone: "0501234568" })).employee_code).toBe("EMP-0002");
  });

  it("each company has its own sequence", async () => {
    const a = await setup();
    const b = await setup();
    expect((await created(a)).employee_code).toBe("EMP-0001");
    expect((await created(b)).employee_code).toBe("EMP-0001");
  });

  it("an empty joining date → today (company time); residence defaults to the company country; ID number uppercased", async () => {
    const ctx = await setup();
    const data = await created(ctx, { joiningDate: "", country_emp_id: "ab-123" });
    const employee = await db.Employee.findByPk(data.id);
    expect(employee).toMatchObject({ date_of_joining: TODAY, residence_country_id: SA, country_emp_id: "AB-123" });
  });

  it("saves residence country + city and the phone's own country (not the nationality)", async () => {
    const ctx = await setup();
    const data = await created(ctx, { residenceCountryId: SA, residenceCityId: RIYADH, phone: "+971501234567", phoneCountry: "AE", nationalityCountryId: IN });
    const employee = await db.Employee.findByPk(data.id);
    expect(employee).toMatchObject({ residence_country_id: SA, residence_city_id: RIYADH, nationality_country_id: IN });
    expect(await db.User.findByPk(employee.user_id)).toMatchObject({ phone_number: "+971501234567", phone_country: "AE" });
  });

  it("in a company with no active approval group, the employee is created without one (no routing row)", async () => {
    const ctx = await setup();
    await approvalGroup(ctx.employer, { is_active: false });
    const data = await created(ctx);
    expect(data.approval_group_id).toBeNull();
    expect(await db.EmployeeApprovalRouting.count({ where: { employee_id: data.id } })).toBe(0);
  });

  it("EMPLOYEE and GENERAL_EMPLOYEE may have no role; a company role is saved on the account", async () => {
    const ctx = await setup();
    const general = await created(ctx, { accessLevel: "GENERAL_EMPLOYEE" });
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: `Role ${short()}` });
    const withRole = await created(ctx, { phone: "0501234568", roleId: role.id });
    const accountOf = async (id) => db.HrmsAccount.findOne({ where: { user_id: (await db.Employee.findByPk(id)).user_id } });
    expect(await accountOf(general.id)).toMatchObject({ access_level: "GENERAL_EMPLOYEE", role_id: null });
    expect(await accountOf(withRole.id)).toMatchObject({ access_level: "EMPLOYEE", role_id: role.id });
  });

  it("the owner can create a SUB_ADMIN with a role", async () => {
    const ctx = await setup();
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: `Role ${short()}` });
    expect((await create(ctx, { accessLevel: "SUB_ADMIN", roleId: role.id })).status).toBe(201);
  });

  it("department, designation and a staffing company (contract) are saved", async () => {
    const ctx = await setup();
    const department = await db.Department.create({ employer_id: ctx.employer.id, name: `Dept ${short()}`, code: `C${short()}`.toUpperCase() });
    const designation = await db.Designation.create({ employer_id: ctx.employer.id, department_id: department.id, name: `Desig ${short()}` });
    const staffing = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf Manpower", code: `GM-${short()}` });
    const data = await created(ctx, { employmentType: "CONTRACT", departmentId: department.id, designationId: designation.id, staffingCompanyId: staffing.id, salaryMode: "HOURLY", hourlyRate: 20, components: [] });
    expect(await db.Employee.findByPk(data.id)).toMatchObject({
      employment_type: "CONTRACT",
      department_id: department.id,
      designation_id: designation.id,
      staffing_company_id: staffing.id,
    });
  });

  it("creating with a draft_id deletes that draft", async () => {
    const ctx = await setup();
    const draft = await db.EmployeeDraft.create({ employer_id: ctx.employer.id, current_step: 5, data: {} });
    await created(ctx, { draft_id: draft.id });
    expect(await db.EmployeeDraft.findByPk(draft.id)).toBeNull();
  });
});

describe("POST /api/employees — login and welcome email (ADRs 0002, 0003)", () => {
  it("sends a welcome email with a temporary password and setup link after commit", async () => {
    const ctx = await setup();
    const data = await created(ctx, { email: "Ahmed.New@Acme.Test" });
    const user = await db.User.scope("withPassword").findByPk((await db.Employee.findByPk(data.id)).user_id);
    expect(user.email).toBe("ahmed.new@acme.test");
    const mails = mailer.outbox().filter((m) => m.to === user.email);
    expect(mails).toHaveLength(1);
    expect(mails[0].template).toBe("welcome-temp-password");
    const temporaryPassword = mails[0].text.match(/Temporary password: (\S+)/)[1];
    expect(await bcrypt.compare(temporaryPassword, user.password)).toBe(true);
    const account = await db.HrmsAccount.findOne({ where: { user_id: user.id } });
    expect(account.password_setup_required).toBe(true);
  });

  it("a person with a password already (ended account elsewhere) gets the welcome email without a temporary password", async () => {
    const other = await setup();
    const ctx = await setup();
    const person = await db.User.create({ name: "Old Name", email: uniqueEmail("moved"), password: await bcrypt.hash("Own#Pass123", 4) });
    await db.HrmsAccount.create({ user_id: person.id, employer_id: other.employer.id, access_level: "EMPLOYEE", status: "INACTIVE", password_setup_required: false });
    const data = await created(ctx, { email: person.email });
    expect((await db.Employee.findByPk(data.id)).user_id).toBe(person.id);
    const mails = mailer.outbox().filter((m) => m.to === person.email);
    expect(mails.map((m) => m.template)).toEqual(["welcome-existing-password"]);
    const stored = await db.User.scope("withPassword").findByPk(person.id);
    expect(await bcrypt.compare("Own#Pass123", stored.password)).toBe(true);
  });

  it("if the email fails, the employee still exists", async () => {
    const ctx = await setup();
    jest.spyOn(mailer, "send").mockRejectedValue(new Error("smtp down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await create(ctx);
    expect(res.status).toBe(201);
    expect(await db.Employee.findByPk(res.body.data.id)).not.toBeNull();
  });
});

describe("POST /api/employees — duplicates", () => {
  it("a duplicate ID number (any case) → 409 EMPLOYEE_ID_NUMBER_TAKEN", async () => {
    const ctx = await setup();
    await created(ctx, { country_emp_id: "ABC-123" });
    const res = await create(ctx, { country_emp_id: "abc-123", phone: "0501234568" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("EMPLOYEE_ID_NUMBER_TAKEN"));
    expect(res.body.message).toBe("An employee with this ID number already exists.");
  });

  it("the same ID number in another company is fine", async () => {
    const a = await setup();
    const b = await setup();
    await created(a, { country_emp_id: "SAME-1" });
    expect((await create(b, { country_emp_id: "SAME-1" })).status).toBe(201);
  });

  it("an email used in this company (an employee, or the owner) → 409 EMPLOYEE_EMAIL_TAKEN", async () => {
    const ctx = await setup();
    const first = await created(ctx);
    const email = (await db.User.findByPk((await db.Employee.findByPk(first.id)).user_id)).email;
    const res = await create(ctx, { email: email.toUpperCase(), phone: "0501234568" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("EMPLOYEE_EMAIL_TAKEN"));
    expect(res.body.message).toBe("An employee with this email already exists.");
    expect((await create(ctx, { email: ctx.owner.email, phone: "0501234569" })).body).toEqual(errorBody("EMPLOYEE_EMAIL_TAKEN"));
  });

  it("an email with a current account in another company → 409 ACCOUNT_EMAIL_IN_OTHER_COMPANY", async () => {
    const other = await setup();
    const ctx = await setup();
    const res = await create(ctx, { email: other.owner.email });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("ACCOUNT_EMAIL_IN_OTHER_COMPANY"));
    expect(res.body.message).toBe("This email is already used by another company.");
  });

  it("a duplicate phone → 409 EMPLOYEE_PHONE_TAKEN; 0501234567 and +966501234567 (SA) are the same number", async () => {
    const ctx = await setup();
    await created(ctx, { phone: "0501234567" });
    const res = await create(ctx, { phone: "+966501234567" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("EMPLOYEE_PHONE_TAKEN"));
    expect(res.body.message).toBe("An employee with this phone number already exists.");
    expect((await create(ctx, { phone: "50 123 4567" })).body).toEqual(errorBody("EMPLOYEE_PHONE_TAKEN"));
  });

  it("the same phone in another company is fine (unique per company, D46)", async () => {
    const a = await setup();
    const b = await setup();
    await created(a, { phone: "0501234567" });
    expect((await create(b, { phone: "0501234567" })).status).toBe(201);
  });
});

describe("GET /api/employees/check-unique", () => {
  it("answers the same three rules for step 1", async () => {
    const ctx = await setup();
    const other = await setup();
    const first = await created(ctx, { country_emp_id: "ABC-123", phone: "0501234567" });
    const email = (await db.User.findByPk((await db.Employee.findByPk(first.id)).user_id)).email;
    const taken = await api.get("/api/employees/check-unique", ctx.token, {
      query: { country_emp_id: "abc-123", email, phone: "+966501234567", phoneCountry: "SA" },
    });
    expect(taken.status).toBe(200);
    expect(taken.body.data).toEqual({
      country_emp_id: { available: false, code: "EMPLOYEE_ID_NUMBER_TAKEN", message: "An employee with this ID number already exists." },
      email: { available: false, code: "EMPLOYEE_EMAIL_TAKEN", message: "An employee with this email already exists." },
      phone: { available: false, code: "EMPLOYEE_PHONE_TAKEN", message: "An employee with this phone number already exists." },
    });
    const elsewhere = await api.get("/api/employees/check-unique", ctx.token, { query: { email: other.owner.email } });
    expect(elsewhere.body.data).toEqual({
      email: { available: false, code: "ACCOUNT_EMAIL_IN_OTHER_COMPANY", message: "This email is already used by another company." },
    });
    const free = await api.get("/api/employees/check-unique", ctx.token, {
      query: { country_emp_id: "NEW-1", email: uniqueEmail("free"), phone: "0501234568", phoneCountry: "SA" },
    });
    expect(free.body.data).toEqual({ country_emp_id: { available: true }, email: { available: true }, phone: { available: true } });
  });

  it("Arabic messages with Accept-Language: ar", async () => {
    const ctx = await setup();
    await created(ctx, { country_emp_id: "ABC-123" });
    const res = await api.get("/api/employees/check-unique", ctx.token, { query: { country_emp_id: "ABC-123" }, lang: "ar" });
    expect(res.body.data.country_emp_id).toEqual({ available: false, code: "EMPLOYEE_ID_NUMBER_TAKEN", message: "يوجد موظف برقم الهوية هذا بالفعل." });
  });

  it("a phone without a valid country → phoneCountry field error", async () => {
    const ctx = await setup();
    const res = await api.get("/api/employees/check-unique", ctx.token, { query: { phone: "0501234567" } });
    expect(res.body).toEqual(validationBody({ phoneCountry: "phoneCountryRequired" }));
  });

  it("needs employee:create or employee:update", async () => {
    const ctx = await setup();
    const reader = (await loginFor(ctx.employer, "SUB_ADMIN", { employee: { ...NO_FLAGS, can_read: true } })).token;
    expect((await api.get("/api/employees/check-unique", reader, { query: { email: "a@b.test" } })).body).toEqual(errorBody("FORBIDDEN"));
    const updater = (await loginFor(ctx.employer, "EMPLOYEE", { employee: { ...NO_FLAGS, can_update: true } })).token;
    expect((await api.get("/api/employees/check-unique", updater, { query: { email: "a@b.test" } })).status).toBe(200);
    expect((await api.get("/api/employees/check-unique", null, { query: {} })).status).toBe(401);
  });
});

describe("POST /api/employees — field rules (standards §7.2)", () => {
  it.each([
    ["name missing", { name: undefined }, { name: "fullNameRequired" }],
    ["name blank", { name: "  " }, { name: "fullNameRequired" }],
    ["name 1 char", { name: "A" }, { name: "min2CharsRequired" }],
    ["name double space", { name: "Ahmed  Ali" }, { name: "multipleSpaces" }],
    ["ID number missing", { country_emp_id: undefined }, { country_emp_id: "countryEmpIdRequired" }],
    ["ID number 2 chars", { country_emp_id: "AB" }, { country_emp_id: "min3CharsRequired" }],
    ["ID number 11 chars", { country_emp_id: "ABCDEFGHIJK" }, { country_emp_id: "max10OrLess" }],
    ["ID number bad chars", { country_emp_id: "AB_12" }, { country_emp_id: "idChars" }],
    ["email missing", { email: undefined }, { email: "emailAddressRequired" }],
    ["email invalid", { email: "nope" }, { email: "emailValidAddress" }],
    ["phone missing", { phone: undefined }, { phone: "phoneNumberRequired" }],
    ["phone invalid for country", { phone: "12345" }, { phone: "phoneInvalidForCountry" }],
    ["phone country missing", { phoneCountry: undefined }, { phoneCountry: "phoneCountryRequired" }],
    ["phone country unknown", { phoneCountry: "XX" }, { phoneCountry: "phoneCountryRequired" }],
    ["nationality missing", { nationalityCountryId: undefined }, { nationalityCountryId: "nationalityRequired" }],
    ["employment type missing", { employmentType: undefined }, { employmentType: "employmentTypeRequired" }],
    ["employment type unknown", { employmentType: "PART_TIME" }, { employmentType: "employmentTypeRequired" }],
    ["access level missing", { accessLevel: undefined }, { accessLevel: "accessLevelRequired" }],
    ["access level STAFFING_COMPANY", { accessLevel: "STAFFING_COMPANY" }, { accessLevel: "accessLevelInvalid" }],
    ["access level unknown", { accessLevel: "BOSS" }, { accessLevel: "accessLevelInvalid" }],
    ["no projects", { projectIds: [] }, { projectIds: "projectRequired" }],
    ["projects missing", { projectIds: undefined }, { projectIds: "projectRequired" }],
    ["main project missing", { mainProjectId: undefined }, { mainProjectId: "mainProjectRequired" }],
    ["joining date not a date", { joiningDate: "2026-02-30" }, { joiningDate: "VALIDATION_FAILED" }],
  ])("%s → 400 with the §7.2 text", async (_label, overrides, fields) => {
    const ctx = await setup();
    const res = await create(ctx, overrides);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(fields));
  });

  it("reports every invalid field at once", async () => {
    const ctx = await setup();
    const res = await api.post("/api/employees", ctx.token, {});
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(
      ["accessLevel", "country_emp_id", "email", "employmentType", "leavePolicyIds", "mainProjectId", "name", "nationalityCountryId", "phone", "phoneCountry", "projectIds", "salaryMode"].sort()
    );
  });

  it.each([
    ["unknown nationality", { nationalityCountryId: MISSING_ID }, { nationalityCountryId: "nationalityRequired" }],
    ["unknown residence country", { residenceCountryId: MISSING_ID }, { residenceCountryId: "countryRequired" }],
    ["residence city not in the residence country", { residenceCountryId: AE, residenceCityId: RIYADH }, { residenceCityId: "cityNotInCountry" }],
    ["unknown residence city", { residenceCityId: MISSING_ID }, { residenceCityId: "cityNotInCountry" }],
  ])("%s → 400 field error", async (_label, overrides, fields) => {
    const ctx = await setup();
    expect((await create(ctx, overrides)).body).toEqual(validationBody(fields));
  });
});

describe("POST /api/employees — access level and role (D48)", () => {
  it("ADMIN → 409 ACCOUNT_ADMIN_EXISTS", async () => {
    const ctx = await setup();
    const res = await create(ctx, { accessLevel: "ADMIN" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("ACCOUNT_ADMIN_EXISTS"));
    expect(res.body.message).toBe("This company already has an owner. Add other admins as Sub Admin.");
  });

  it("a non-owner creating a SUB_ADMIN → 403 FORBIDDEN", async () => {
    const ctx = await setup();
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: `Role ${short()}` });
    const creator = await loginFor(ctx.employer, "SUB_ADMIN", { employee: { can_create: true, can_update: true } });
    const res = await create(ctx, { accessLevel: "SUB_ADMIN", roleId: role.id }, creator.token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("a SUB_ADMIN without a role → roleId 'Role is required'", async () => {
    const ctx = await setup();
    expect((await create(ctx, { accessLevel: "SUB_ADMIN" })).body).toEqual(validationBody({ roleId: "roleRequired" }));
  });

  it("another company's (or an unknown) role → 404 NOT_FOUND", async () => {
    const ctx = await setup();
    const other = await setup();
    const theirs = await db.Role.create({ employer_id: other.employer.id, name: `Role ${short()}` });
    for (const roleId of [theirs.id, MISSING_ID, "nope"]) {
      expect((await create(ctx, { roleId })).body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("POST /api/employees — projects and joining date (D49)", () => {
  it.each(["ON_HOLD", "COMPLETED"])("a %s project → projectIds 'Select active projects only.'", async (status) => {
    const ctx = await setup();
    const stopped = await createProject(ctx.employer, { status });
    const res = await create(ctx, { projectIds: [ctx.project.id, stopped.id] });
    expect(res.body).toEqual(validationBody({ projectIds: "projectsActiveOnly" }));
  });

  it("main project not among the projects → mainProjectId 'Main project must be one of the selected projects'", async () => {
    const ctx = await setup();
    const second = await createProject(ctx.employer);
    expect((await create(ctx, { mainProjectId: second.id })).body).toEqual(validationBody({ mainProjectId: "mainProjectInSelection" }));
  });

  it("a GENERAL_EMPLOYEE with two projects → projectIds 'A General Employee can be assigned to only one project'", async () => {
    const ctx = await setup();
    const second = await createProject(ctx.employer);
    const res = await create(ctx, { accessLevel: "GENERAL_EMPLOYEE", projectIds: [ctx.project.id, second.id] });
    expect(res.body).toEqual(validationBody({ projectIds: "generalOneProject" }));
  });

  it("another company's or an unknown project → 404 NOT_FOUND", async () => {
    const ctx = await setup();
    const other = await setup();
    for (const id of [other.project.id, MISSING_ID]) {
      expect((await create(ctx, { projectIds: [ctx.project.id, id] })).body).toEqual(errorBody("NOT_FOUND"));
    }
  });

  it("joining before the main project's start → joiningDate error; on the start day is fine", async () => {
    const ctx = await setup();
    expect((await create(ctx, { joiningDate: "2025-12-31" })).body).toEqual(validationBody({ joiningDate: "joiningBeforeProjectStart" }));
    expect((await create(ctx, { joiningDate: "2026-01-01" })).status).toBe(201);
  });

  it("more than 12 months ahead → joiningDate error; exactly 12 months is fine", async () => {
    const ctx = await setup();
    expect((await create(ctx, { joiningDate: "2027-10-22" })).body).toEqual(validationBody({ joiningDate: "joiningTooFar" }));
    expect((await create(ctx, { joiningDate: "2027-10-21" })).status).toBe(201);
  });
});

describe("POST /api/employees — approval group (D18, D51)", () => {
  it("once the company has an active group: none, unknown, another company's or an inactive group → approvalGroupId error", async () => {
    const ctx = await setup();
    const other = await setup();
    await approvalGroup(ctx.employer);
    const inactive = await approvalGroup(ctx.employer, { is_active: false });
    const theirs = await approvalGroup(other.employer);
    for (const approvalGroupId of [undefined, MISSING_ID, inactive.id, theirs.id]) {
      const res = await create(ctx, { approvalGroupId });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ approvalGroupId: "approvalGroupRequired" }));
    }
  });

  it("a PROJECT group of another project → 409 APPROVAL_GROUP_PROJECT_MISMATCH; of the main project → fine", async () => {
    const ctx = await setup();
    const second = await createProject(ctx.employer);
    const wrong = await approvalGroup(ctx.employer, { scope: "PROJECT", project_id: second.id });
    const right = await approvalGroup(ctx.employer, { scope: "PROJECT", project_id: ctx.project.id });
    const res = await create(ctx, { approvalGroupId: wrong.id });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("APPROVAL_GROUP_PROJECT_MISMATCH"));
    expect(res.body.message).toBe("This approval group belongs to a different project.");
    expect((await create(ctx, { approvalGroupId: right.id })).status).toBe(201);
  });

  it("per-module routing → 400 APPROVAL_ROUTING_PER_MODULE_DISABLED", async () => {
    const ctx = await setup();
    const res = await create(ctx, { moduleKey: "LEAVE" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("APPROVAL_ROUTING_PER_MODULE_DISABLED"));
    expect(res.body.message).toBe("Per-module routing isn't available yet.");
  });
});

describe("POST /api/employees — department, designation, staffing company (D50)", () => {
  const dept = (employer, overrides = {}) =>
    db.Department.create({ employer_id: employer.id, name: `Dept ${short()}`, code: `C${short()}`.toUpperCase(), ...overrides });
  const desig = (employer, department, overrides = {}) =>
    db.Designation.create({ employer_id: employer.id, department_id: department.id, name: `Desig ${short()}`, ...overrides });

  it("an inactive department → departmentId 'Select an active department.'", async () => {
    const ctx = await setup();
    const d = await dept(ctx.employer, { status: "INACTIVE" });
    expect((await create(ctx, { departmentId: d.id })).body).toEqual(validationBody({ departmentId: "departmentActive" }));
  });

  it("an inactive designation, one of another department, or one without a department → designationId error", async () => {
    const ctx = await setup();
    const d = await dept(ctx.employer);
    const otherDept = await dept(ctx.employer);
    const inactive = await desig(ctx.employer, d, { status: "INACTIVE" });
    const elsewhere = await desig(ctx.employer, otherDept);
    for (const overrides of [
      { departmentId: d.id, designationId: inactive.id },
      { departmentId: d.id, designationId: elsewhere.id },
      { designationId: elsewhere.id },
    ]) {
      expect((await create(ctx, overrides)).body).toEqual(validationBody({ designationId: "designationActive" }));
    }
  });

  it("a staffing company on a Full-time employee → staffingCompanyId 'A staffing company applies only to contract employees.'", async () => {
    const ctx = await setup();
    const s = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf", code: `GM-${short()}` });
    expect((await create(ctx, { staffingCompanyId: s.id })).body).toEqual(validationBody({ staffingCompanyId: "staffingContractOnly" }));
  });

  it("an inactive staffing company → staffingCompanyId 'Select an active staffing company.'", async () => {
    const ctx = await setup();
    const s = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf", code: `GM-${short()}`, status: "INACTIVE" });
    expect((await create(ctx, { employmentType: "CONTRACT", staffingCompanyId: s.id })).body).toEqual(validationBody({ staffingCompanyId: "staffingActive" }));
  });

  it("another company's department, designation, staffing company or draft → 404 NOT_FOUND", async () => {
    const ctx = await setup();
    const other = await setup();
    const d = await dept(other.employer);
    const g = await desig(other.employer, d);
    const s = await db.StaffingCompany.create({ employer_id: other.employer.id, name: "Theirs", code: `GM-${short()}` });
    const draft = await db.EmployeeDraft.create({ employer_id: other.employer.id, current_step: 1, data: {} });
    for (const overrides of [{ departmentId: d.id }, { departmentId: d.id, designationId: g.id }, { employmentType: "CONTRACT", staffingCompanyId: s.id }, { draft_id: draft.id }]) {
      expect((await create(ctx, overrides)).body).toEqual(errorBody("NOT_FOUND"));
    }
    expect(await db.EmployeeDraft.findByPk(draft.id)).not.toBeNull();
  });
});

describe("POST /api/employees — all or nothing, permissions", () => {
  it("a failure late in the transaction leaves nothing behind (no user, account, assignments, sequence step)", async () => {
    const ctx = await setup();
    const group = await approvalGroup(ctx.employer);
    const draft = await db.EmployeeDraft.create({ employer_id: ctx.employer.id, current_step: 5, data: {} });
    const before = await countRows(ctx.employer);
    jest.spyOn(db.EmployeeApprovalRouting, "create").mockRejectedValue(new Error("boom"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const email = uniqueEmail("rollback");
    const res = await create(ctx, { email, approvalGroupId: group.id, draft_id: draft.id });
    expect(res.status).toBe(500);
    expect(await countRows(ctx.employer)).toEqual(before);
    expect(await db.User.findOne({ where: { email } })).toBeNull();
    expect(await db.EmployeeDraft.findByPk(draft.id)).not.toBeNull();
    expect(mailer.outbox()).toEqual([]);
    jest.restoreAllMocks();
    jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`));
    expect((await created(ctx, { approvalGroupId: group.id })).employee_code).toBe("EMP-0001");
  });

  it("without employee:create → 403; staffing login → 403; no token → 401", async () => {
    const ctx = await setup();
    for (const level of ["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE"]) {
      const { token } = await loginFor(ctx.employer, level, { employee: { ...NO_FLAGS, can_read: true, can_update: true, can_delete: true } });
      const res = await create(ctx, {}, token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    }
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", CREATOR)).token;
    expect((await create(ctx, {}, staffing)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await create(ctx, {}, null)).body).toEqual(errorBody("AUTH_REQUIRED"));
    expect(await db.Employee.count({ where: { employer_id: ctx.employer.id } })).toBe(0);
  });

  it("an EMPLOYEE with employee:create can create employees", async () => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, "EMPLOYEE", CREATOR);
    expect((await create(ctx, {}, token)).status).toBe(201);
  });

  it("the new person's existing employees elsewhere don't matter for this company's checks", async () => {
    const ctx = await setup();
    const other = await setup();
    await createEmployee(other.employer, { country_emp_id: "XYZ-9" });
    expect((await create(ctx, { country_emp_id: "XYZ-9" })).status).toBe(201);
  });
});
