const { db, uniqueEmail, MISSING_ID, errorBody, validationBody, loginFor, createProject, assign, api, NO_FLAGS } = require("./helpers/api");
const { IN, employeeSetup, createLeavePolicy, createdEmployee } = require("./helpers/employees");
const { seedId } = require("../src/utils/seed");
const { clock } = require("../src/utils/clock");
const approvals = require("../src/services/approval.service");

// Employee edit API (ticket workforce#14b; workforce D33, D40, D48, D51, D54, D56a).

const TODAY = "2026-10-21";
const AE = seedId("country:AE");
const RIYADH = seedId("city:Riyadh");

beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

let phoneNo = 2000;
const nextPhone = () => `05013${String((phoneNo += 1)).padStart(5, "0")}`;
const add = (ctx, overrides = {}) => createdEmployee(ctx, { phone: nextPhone(), joiningDate: "2026-09-01", ...overrides });

// The edit body for an employee as created by add(): their current values, changed by `overrides`.
const editBody = async (ctx, data, overrides = {}) => {
  const employee = await db.Employee.findByPk(data.id);
  const user = await db.User.findByPk(employee.user_id);
  const account = await db.HrmsAccount.findOne({ where: { user_id: user.id, employer_id: ctx.employer.id } });
  const policies = await db.EmployeeLeavePolicy.findAll({ where: { employee_id: employee.id, is_active: true } });
  const routing = await db.EmployeeApprovalRouting.findOne({ where: { employee_id: employee.id } });
  return {
    name: employee.full_name,
    country_emp_id: employee.country_emp_id,
    email: user.email,
    phone: user.phone_number,
    phoneCountry: user.phone_country,
    nationalityCountryId: employee.nationality_country_id,
    employmentType: employee.employment_type,
    accessLevel: account.access_level,
    roleId: account.role_id,
    shiftId: employee.shift_id,
    leavePolicyIds: policies.map((p) => p.leave_policy_id),
    approvalGroupId: routing ? routing.approval_group_id : null,
    ...overrides,
  };
};
const edit = async (ctx, data, overrides, token = ctx.token) => api.put(`/api/employees/${data.id}`, token, await editBody(ctx, data, overrides));

const group = (ctx, overrides = {}) =>
  db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: `G ${Math.random()}`, group_code: `G${Date.now()}${Math.random()}`.slice(0, 40), module_key: "ALL", ...overrides });

describe("PUT /api/employees/:id — basic and job fields", () => {
  it("updates name, ID number, email, phone, nationality, residence, type, department, designation; returns the detail", async () => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    const department = await db.Department.create({ employer_id: ctx.employer.id, name: "Civil", code: "CIV" });
    const designation = await db.Designation.create({ employer_id: ctx.employer.id, department_id: department.id, name: "Engineer" });
    const email = uniqueEmail("edited");
    const res = await edit(ctx, data, {
      name: "Ahmed Ali Khan",
      country_emp_id: "new-77",
      email: email.toUpperCase(),
      phone: "+971501112222",
      phoneCountry: "AE",
      nationalityCountryId: AE,
      residenceCountryId: seedId("country:SA"),
      residenceCityId: RIYADH,
      employmentType: "CONTRACT",
      departmentId: department.id,
      designationId: designation.id,
      address: "Olaya, Riyadh",
      // Ignored on edit (salary not editable, D52; projects through 05 and 15).
      salaryMode: "HOURLY",
      components: [],
      projectIds: [MISSING_ID],
      mainProjectId: MISSING_ID,
      joiningDate: "2026-01-01",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.overview).toMatchObject({
      name: "Ahmed Ali Khan",
      country_emp_id: "NEW-77",
      email,
      phone: "+971501112222",
      phoneCountry: "AE",
      nationality: { id: AE, name: "United Arab Emirates" },
      residence_city: { id: RIYADH, name: "Riyadh" },
      employment_type: "CONTRACT",
      department: { id: department.id, name: "Civil" },
      designation: { id: designation.id, name: "Engineer" },
      address: "Olaya, Riyadh",
      joining_date: "2026-09-01",
    });
    expect(res.body.data.salary.mode).toBe("MONTHLY_FIXED");
    expect(res.body.data.projects.current.map((p) => p.id)).toEqual([ctx.project.id]);
  });

  it.each([
    ["name too short", { name: "A" }, { name: "min2CharsRequired" }],
    ["bad ID number", { country_emp_id: "A_1" }, { country_emp_id: "idChars" }],
    ["email invalid", { email: "nope" }, { email: "emailValidAddress" }],
    ["phone invalid", { phone: "123" }, { phone: "phoneInvalidForCountry" }],
    ["nationality missing", { nationalityCountryId: null }, { nationalityCountryId: "nationalityRequired" }],
    ["city not in residence country", { residenceCountryId: AE, residenceCityId: RIYADH }, { residenceCityId: "cityNotInCountry" }],
    ["staffing company on Full-time", "staffing", { staffingCompanyId: "staffingContractOnly" }],
    ["no leave policy", { leavePolicyIds: [] }, { leavePolicyIds: "leavePolicyRequired" }],
    ["access level STAFFING_COMPANY", { accessLevel: "STAFFING_COMPANY" }, { accessLevel: "accessLevelInvalid" }],
  ])("%s → the create rule's field error", async (_label, overrides, fields) => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    let change = overrides;
    if (overrides === "staffing") {
      const s = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf", code: "GM-E" });
      change = { staffingCompanyId: s.id };
    }
    expect((await edit(ctx, data, change)).body).toEqual(validationBody(fields));
  });

  it("duplicates of another employee → EMPLOYEE_ID_NUMBER_TAKEN / EMPLOYEE_EMAIL_TAKEN / EMPLOYEE_PHONE_TAKEN; keeping your own values is fine", async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx, { country_emp_id: "AAA-1" });
    const b = await add(ctx);
    const aBody = await editBody(ctx, a);
    expect((await edit(ctx, b, { country_emp_id: "aaa-1" })).body).toEqual(errorBody("EMPLOYEE_ID_NUMBER_TAKEN"));
    expect((await edit(ctx, b, { email: aBody.email })).body).toEqual(errorBody("EMPLOYEE_EMAIL_TAKEN"));
    expect((await edit(ctx, b, { phone: aBody.phone })).body).toEqual(errorBody("EMPLOYEE_PHONE_TAKEN"));
    expect((await edit(ctx, a, {})).status).toBe(200);
  });

  it("an email with a current account in another company → ACCOUNT_EMAIL_IN_OTHER_COMPANY", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const data = await add(ctx);
    expect((await edit(ctx, data, { email: other.owner.email })).body).toEqual(errorBody("ACCOUNT_EMAIL_IN_OTHER_COMPANY"));
  });

  it("another company's role, department or shift → 404", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const data = await add(ctx);
    const role = await db.Role.create({ employer_id: other.employer.id, name: "Theirs" });
    const dept = await db.Department.create({ employer_id: other.employer.id, name: "Theirs", code: "TH" });
    const shift = await db.CompanyShift.create({ employer_id: other.employer.id, name: "Theirs", start_time: "08:00:00", end_time: "17:00:00" });
    for (const change of [{ roleId: role.id }, { departmentId: dept.id }, { shiftId: shift.id }]) {
      expect((await edit(ctx, data, change)).body).toEqual(errorBody("NOT_FOUND"));
    }
  });
});

describe("PUT /api/employees/:id — access level (D48)", () => {
  it("a non-owner changing someone to SUB_ADMIN → 403; the owner can", async () => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: "Admins" });
    const editor = await loginFor(ctx.employer, "SUB_ADMIN", { employee: { can_update: true } });
    expect((await edit(ctx, data, { accessLevel: "SUB_ADMIN", roleId: role.id }, editor.token)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await edit(ctx, data, { accessLevel: "SUB_ADMIN" })).body).toEqual(validationBody({ roleId: "roleRequired" }));
    expect((await edit(ctx, data, { accessLevel: "SUB_ADMIN", roleId: role.id })).status).toBe(200);
    expect((await db.HrmsAccount.findOne({ where: { user_id: (await db.Employee.findByPk(data.id)).user_id } })).toJSON()).toMatchObject({
      access_level: "SUB_ADMIN",
      role_id: role.id,
    });
  });

  it("ADMIN → 409 ACCOUNT_ADMIN_EXISTS", async () => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    expect((await edit(ctx, data, { accessLevel: "ADMIN" })).body).toEqual(errorBody("ACCOUNT_ADMIN_EXISTS"));
  });

  it("the owner's own record can't be changed → 403 ACCOUNT_OWNER_PROTECTED", async () => {
    const ctx = await employeeSetup();
    const ownerEmployee = await db.Employee.create({ user_id: ctx.owner.id, employer_id: ctx.employer.id, employee_code: "EMP-9000", country_emp_id: "OWN-1", full_name: "Owner Person", employment_type: "FULL_TIME" });
    const res = await api.put(`/api/employees/${ownerEmployee.id}`, ctx.token, {
      name: "Owner Person",
      country_emp_id: "OWN-1",
      email: ctx.owner.email,
      phone: "0509999999",
      phoneCountry: "SA",
      nationalityCountryId: IN,
      employmentType: "FULL_TIME",
      accessLevel: "EMPLOYEE",
      leavePolicyIds: [ctx.policy.id],
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("ACCOUNT_OWNER_PROTECTED"));
    expect(res.body.message).toBe("The company owner's account can't be changed.");
  });

  it("to GENERAL_EMPLOYEE with more than one current project → 409 PROJECT_GENERAL_EMPLOYEE_SINGLE", async () => {
    const ctx = await employeeSetup();
    const second = await createProject(ctx.employer);
    const data = await add(ctx, { projectIds: [ctx.project.id, second.id] });
    const res = await edit(ctx, data, { accessLevel: "GENERAL_EMPLOYEE" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("PROJECT_GENERAL_EMPLOYEE_SINGLE"));
    expect(res.body.message).toBe("General employees can belong to only one project.");
    const single = await add(ctx);
    expect((await edit(ctx, single, { accessLevel: "GENERAL_EMPLOYEE" })).status).toBe(200);
  });
});

describe("PUT /api/employees/:id — shift (D40)", () => {
  const shifts = async (ctx) => ({
    day: await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Day", start_time: "08:00:00", end_time: "17:00:00" }),
    night: await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Night", start_time: "20:00:00", end_time: "05:00:00" }),
  });
  const historyOf = (data) => db.EmployeeShiftHistory.findAll({ where: { employee_id: data.id }, order: [["effective_from", "ASC"]], raw: true });

  it("a change is effective today with a history row; a second change today overwrites it; clearing writes no row", async () => {
    const ctx = await employeeSetup();
    const { day, night } = await shifts(ctx);
    const data = await add(ctx, { shiftId: day.id });
    await edit(ctx, data, { shiftId: night.id });
    expect((await historyOf(data)).map((h) => [h.shift_id, h.effective_from])).toEqual([
      [day.id, "2026-09-01"],
      [night.id, TODAY],
    ]);
    await edit(ctx, data, { shiftId: day.id });
    expect((await historyOf(data)).map((h) => [h.shift_id, h.effective_from])).toEqual([
      [day.id, "2026-09-01"],
      [day.id, TODAY],
    ]);
    await edit(ctx, data, { shiftId: null });
    expect((await db.Employee.findByPk(data.id)).shift_id).toBeNull();
    expect(await historyOf(data)).toHaveLength(2);
  });

  it("an unchanged shift writes no row", async () => {
    const ctx = await employeeSetup();
    const { day } = await shifts(ctx);
    const data = await add(ctx, { shiftId: day.id });
    await edit(ctx, data, { name: "Renamed Person" });
    expect(await historyOf(data)).toHaveLength(1);
  });
});

describe("PUT /api/employees/:id — leave policies (D33)", () => {
  it("removing a policy ends it today and keeps its balance; adding one creates a balance per 13b", async () => {
    const ctx = await employeeSetup();
    const upfront = await createLeavePolicy(ctx.employer, { accrual_method: "UPFRONT", yearly_quota: 21, prorate_joiners: true });
    const data = await add(ctx);
    const res = await edit(ctx, data, { leavePolicyIds: [upfront.id] });
    expect(res.status).toBe(200);
    const removed = await db.EmployeeLeavePolicy.findOne({ where: { employee_id: data.id, leave_policy_id: ctx.policy.id } });
    expect([removed.is_active, removed.effective_to]).toEqual([false, TODAY]);
    expect(await db.LeaveBalance.count({ where: { employee_id: data.id, leave_policy_id: ctx.policy.id } })).toBe(1);
    const added = await db.EmployeeLeavePolicy.findOne({ where: { employee_id: data.id, leave_policy_id: upfront.id } });
    expect([added.is_active, added.effective_from]).toEqual([true, TODAY]);
    const balance = await db.LeaveBalance.findOne({ where: { employee_id: data.id, leave_policy_id: upfront.id } });
    // 21 Oct – 31 Dec 2026 = 72 of 365 days → 21 × 72 / 365 = 4.14 → 4
    expect(Number(balance.available_balance)).toBe(4);
  });

  it("a kept policy that has since become inactive stays; a newly added inactive one is refused", async () => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    await ctx.policy.update({ is_active: false });
    expect((await edit(ctx, data, {})).status).toBe(200);
    const inactive = await createLeavePolicy(ctx.employer, { is_active: false });
    expect((await edit(ctx, data, { leavePolicyIds: [ctx.policy.id, inactive.id] })).body).toEqual(validationBody({ leavePolicyIds: "leavePoliciesActive" }));
  });

  it("two of the same type → leavePolicyPerType", async () => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    const same = await db.LeavePolicy.create({ employer_id: ctx.employer.id, leave_type_id: ctx.policy.leave_type_id, policy_name: "Other", yearly_quota: 5 });
    expect((await edit(ctx, data, { leavePolicyIds: [ctx.policy.id, same.id] })).body).toEqual(validationBody({ leavePolicyIds: "leavePolicyPerType" }));
  });
});

describe("PUT /api/employees/:id — approval group (D51)", () => {
  it("setting a group on someone with none creates the routing row", async () => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    const g = await group(ctx);
    expect((await edit(ctx, data, { approvalGroupId: g.id })).body.data.approval_group).toMatchObject({ id: g.id });
    expect(await db.EmployeeApprovalRouting.count({ where: { employee_id: data.id } })).toBe(1);
  });

  it("changing it doesn't move pending requests (they keep their frozen group)", async () => {
    const ctx = await employeeSetup();
    const g1 = await group(ctx);
    const g2 = await group(ctx);
    const data = await add(ctx, { approvalGroupId: g1.id });
    approvals.registerEntity("EDIT_TEST", { moduleKey: "TEST", label: { en: "Test", ar: "اختبار" }, codePrefix: "TST" });
    const request = await db.sequelize.transaction((transaction) =>
      approvals.raise({ employerId: ctx.employer.id, entityType: "EDIT_TEST", entityId: data.id, subjectEmployeeId: data.id, raisedBy: { userId: ctx.owner.id, employeeId: null }, transaction })
    );
    await edit(ctx, data, { approvalGroupId: g2.id });
    expect((await db.EmployeeApprovalRouting.findOne({ where: { employee_id: data.id } })).approval_group_id).toBe(g2.id);
    expect((await request.reload()).approval_group_id).toBe(g1.id);
  });

  it("with an active group in the company, none / inactive → 'Select an approval group.'; another project's PROJECT group → mismatch", async () => {
    const ctx = await employeeSetup();
    const g = await group(ctx);
    const inactive = await group(ctx, { is_active: false });
    const second = await createProject(ctx.employer);
    const elsewhere = await group(ctx, { scope: "PROJECT", project_id: second.id });
    const data = await add(ctx, { approvalGroupId: g.id });
    for (const approvalGroupId of [null, inactive.id, MISSING_ID]) {
      expect((await edit(ctx, data, { approvalGroupId })).body).toEqual(validationBody({ approvalGroupId: "approvalGroupRequired" }));
    }
    expect((await edit(ctx, data, { approvalGroupId: elsewhere.id })).body).toEqual(errorBody("APPROVAL_GROUP_PROJECT_MISMATCH"));
    expect((await edit(ctx, data, { moduleKey: "LEAVE" })).body).toEqual(errorBody("APPROVAL_ROUTING_PER_MODULE_DISABLED"));
  });
});

describe("PUT /api/employees/:id — exited, permissions", () => {
  it("an exited employee → 409 EMPLOYEE_EXITED; an IN_NOTICE employee can be edited", async () => {
    const ctx = await employeeSetup();
    const data = await add(ctx);
    await db.Employee.update({ employment_status: "IN_NOTICE" }, { where: { id: data.id } });
    expect((await edit(ctx, data, { name: "Still Here" })).status).toBe(200);
    await db.Employee.update({ employment_status: "EXITED" }, { where: { id: data.id } });
    const res = await edit(ctx, data, { name: "Gone Now" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("EMPLOYEE_EXITED"));
    expect((await db.Employee.findByPk(data.id)).full_name).toBe("Still Here");
  });

  it("FORBIDDEN without employee:update; staffing → 403; no token → 401; another company's / unknown → 404", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const data = await add(ctx);
    const theirs = await add(other);
    const body = await editBody(ctx, data);
    const none = (await loginFor(ctx.employer, "SUB_ADMIN", { employee: { ...NO_FLAGS, can_read: true, can_create: true, can_delete: true } })).token;
    expect((await api.put(`/api/employees/${data.id}`, none, body)).body).toEqual(errorBody("FORBIDDEN"));
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { employee: { can_update: true } })).token;
    expect((await api.put(`/api/employees/${data.id}`, staffing, body)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await api.put(`/api/employees/${data.id}`, null, body)).status).toBe(401);
    for (const id of [theirs.id, MISSING_ID, "nope"]) {
      expect((await api.put(`/api/employees/${id}`, ctx.token, body)).body).toEqual(errorBody("NOT_FOUND"));
    }
    const updater = (await loginFor(ctx.employer, "EMPLOYEE", { employee: { can_update: true } })).token;
    expect((await api.put(`/api/employees/${data.id}`, updater, body)).status).toBe(200);
  });

  it("assigning a project elsewhere (05) doesn't confuse the GENERAL_EMPLOYEE rule", async () => {
    const ctx = await employeeSetup();
    const second = await createProject(ctx.employer);
    const data = await add(ctx);
    await assign(await db.Employee.findByPk(data.id), second);
    expect((await edit(ctx, data, { accessLevel: "GENERAL_EMPLOYEE" })).body).toEqual(errorBody("PROJECT_GENERAL_EMPLOYEE_SINGLE"));
  });
});
