const { db, MISSING_ID, errorBody, validationBody, loginFor, createProject, api } = require("./helpers/api");
const { employeeSetup, createdEmployee, createLeavePolicy } = require("./helpers/employees");
const { clock } = require("../src/utils/clock");
const mailer = require("../src/services/mailer");

// Rehire (ticket workforce#19; workforce D67, D63; standards §7.1 REHIRE_*, §7.2 "Rehire").

const TODAY = "2026-10-21";
process.env.MAIL_DRIVER = "memory";

beforeEach(() => {
  jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`));
  mailer.clear();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const CREATOR = { employee: { can_create: true } };
let phoneNo = 9000;
const add = (ctx, overrides = {}) =>
  createdEmployee(ctx, { phone: `05019${String((phoneNo += 1)).padStart(5, "0")}`, joiningDate: "2026-03-01", ...overrides });

// An exit processed on LWD 2026-10-15 (the owner may backdate it), so rehire is allowed from
// 2026-10-16 with 0 cooling days.
const exitTerms = (overrides = {}) => ({
  exitType: "TERMINATION",
  reasonCategory: "REDUNDANCY",
  reason: "The project phase has been completed.",
  noticeStartDate: "2026-10-01",
  lastWorkingDay: "2026-10-15",
  rehireEligible: true,
  coolingPeriodDays: 0,
  ...overrides,
});

const exitEmployee = async (ctx, employee, overrides) => {
  const res = await api.post(`/api/employees/${employee.id}/exits`, ctx.token, exitTerms(overrides));
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  const exit = await db.EmployeeExit.findByPk(res.body.data.id);
  const approved = await api.post(`/api/approvals/${exit.approval_request_id}/approve`, ctx.token, { reason: "Approved after review" });
  if (approved.status !== 200) throw new Error(JSON.stringify(approved.body));
  return exit.reload();
};

// A company with one employee who has exited (EXITED, rehire eligible from 2026-10-16).
const setup = async ({ employee = {}, exit } = {}) => {
  const ctx = await employeeSetup();
  const leaver = await add(ctx, { name: "Rami Return", ...employee });
  const exitRow = await exitEmployee(ctx, leaver, exit);
  expect(exitRow.status).toBe("EXITED");
  mailer.clear();
  return { ...ctx, leaver, exit: exitRow };
};

const rehire = (token, exit, body = {}) => api.post(`/api/exits/${exit.id || exit}/rehire`, token, body);
const employeeOf = (ctx) => db.Employee.findByPk(ctx.leaver.id);
const accountOf = async (ctx) => db.HrmsAccount.findOne({ where: { user_id: (await employeeOf(ctx)).user_id, employer_id: ctx.employer.id } });
const activeProjects = (ctx) => db.EmployeeProject.findAll({ where: { employee_id: ctx.leaver.id, is_active: true }, raw: true });

describe("POST /api/exits/:id/rehire — success", () => {
  it("rehires on the same record and Employee ID; joining date = today; the exit keeps its dates and gets REHIRED", async () => {
    const ctx = await setup();
    const res = await rehire(ctx.token, ctx.exit);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: ctx.leaver.id,
      employee_code: ctx.leaver.employee_code,
      employment_status: "ACTIVE",
      joining_date: TODAY,
      main_project_id: ctx.project.id,
      access_level: "EMPLOYEE",
    });
    const employee = await employeeOf(ctx);
    expect(employee).toMatchObject({ employment_status: "ACTIVE", employee_code: ctx.leaver.employee_code, date_of_joining: TODAY, exit_date: null });

    await ctx.exit.reload();
    expect(ctx.exit).toMatchObject({ status: "EXITED", last_working_day: "2026-10-15", original_last_working_day: "2026-10-15", rehire_allowed_from: "2026-10-16" });
    const events = await db.ExitEvent.findAll({ where: { exit_id: ctx.exit.id, event_type: "REHIRED" }, raw: true });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actor_user_id: ctx.owner.id, payload: { rehire_date: TODAY } });
  });

  it("a rehire date up to 90 days ahead → joining date, assignment, main period and history start then", async () => {
    const ctx = await setup();
    const res = await rehire(ctx.token, ctx.exit, { rehireDate: "2027-01-19" });
    expect(res.status).toBe(200);
    expect((await employeeOf(ctx)).date_of_joining).toBe("2027-01-19");
    const [row] = await activeProjects(ctx);
    expect(row).toMatchObject({ project_id: ctx.project.id, main_project: 1, start_date: "2027-01-19", end_date: null, main_project_date_start: "2027-01-19", main_project_date_end: null });
    const period = await db.EmployeeMainProjectPeriod.findOne({ where: { employee_id: ctx.leaver.id, date_to: null }, raw: true });
    expect(period).toMatchObject({ project_id: ctx.project.id, date_from: "2027-01-19" });
    const assigned = await db.EmployeeProjectHistory.findAll({ where: { employee_id: ctx.leaver.id, action: "ASSIGNED" }, order: [["effective_date", "ASC"]], raw: true });
    expect(assigned.map((h) => h.effective_date)).toEqual(["2026-03-01", "2027-01-19"]);
  });

  it("reactivates the same account and emails a new temporary password and setup link", async () => {
    const ctx = await setup();
    const before = await accountOf(ctx);
    expect(before.status).toBe("INACTIVE");
    // The person had set their own password before leaving.
    await db.HrmsAccount.update({ password_setup_required: false, password_setup_token_hash: null }, { where: { id: before.id } });
    expect((await rehire(ctx.token, ctx.exit)).status).toBe(200);
    const after = await accountOf(ctx);
    expect(after.id).toBe(before.id);
    expect(after).toMatchObject({ status: "ACTIVE", password_setup_required: true });
    expect(after.password_setup_token_hash).toBeTruthy();
    const mails = mailer.outbox().filter((m) => m.to === ctx.leaver.email);
    expect(mails.map((m) => m.template)).toEqual(["welcome-temp-password"]);
    expect(mails[0].text).toMatch(/reset-password\?setup=\S+/);
  });
});

describe("rehire date", () => {
  it("more than 90 days ahead → 'Rehire date cannot be more than 90 days ahead'; invalid → 'Enter a valid rehire date'", async () => {
    const ctx = await setup();
    let res = await rehire(ctx.token, ctx.exit, { rehireDate: "2027-01-20" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ rehireDate: "rehireTooFar" }));
    expect(res.body.errors.rehireDate).toBe("Rehire date cannot be more than 90 days ahead");
    for (const rehireDate of ["2026-02-30", "soon", 20261101]) {
      res = await rehire(ctx.token, ctx.exit, { rehireDate });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ rehireDate: "rehireDateInvalid" }));
      expect(res.body.errors.rehireDate).toBe("Enter a valid rehire date");
    }
    expect((await employeeOf(ctx)).employment_status).toBe("EXITED");
  });

  it("before rehire_allowed_from → 409 REHIRE_NOT_ALLOWED with the date", async () => {
    const ctx = await setup({ exit: { coolingPeriodDays: 30 } });
    expect(ctx.exit.rehire_allowed_from).toBe("2026-11-15");
    let res = await rehire(ctx.token, ctx.exit);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, code: "REHIRE_NOT_ALLOWED", message: "This employee isn't eligible for rehire until 2026-11-15." });
    res = await rehire(ctx.token, ctx.exit, { rehireDate: "2026-11-14" });
    expect(res.body.code).toBe("REHIRE_NOT_ALLOWED");
    expect((await employeeOf(ctx)).employment_status).toBe("EXITED");
    // On the day itself it's allowed.
    expect((await rehire(ctx.token, ctx.exit, { rehireDate: "2026-11-15" })).status).toBe(200);
  });

  it("not rehire-eligible → 409 REHIRE_NOT_ELIGIBLE", async () => {
    const ctx = await setup({ exit: { rehireEligible: false } });
    const res = await rehire(ctx.token, ctx.exit);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("REHIRE_NOT_ELIGIBLE"));
    expect(res.body.message).toBe("This employee isn't eligible for rehire.");
    expect((await employeeOf(ctx)).employment_status).toBe("EXITED");
  });
});

describe("main project", () => {
  it("the chosen ACTIVE project becomes the main project", async () => {
    const ctx = await setup();
    const other = await createProject(ctx.employer, { start_date: "2026-01-01" });
    const res = await rehire(ctx.token, ctx.exit, { mainProjectId: other.id });
    expect(res.status).toBe(200);
    expect(res.body.data.main_project_id).toBe(other.id);
    const rows = await activeProjects(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ project_id: other.id, main_project: 1, start_date: TODAY });
  });

  it("no choice and the last main project isn't ACTIVE, or an inactive/unknown choice → 'Select an active main project.'", async () => {
    const ctx = await setup();
    await db.Project.update({ status: "ON_HOLD" }, { where: { id: ctx.project.id } });
    const theirs = await createProject((await employeeSetup()).employer);
    for (const body of [{}, { mainProjectId: ctx.project.id }, { mainProjectId: MISSING_ID }, { mainProjectId: theirs.id }, { mainProjectId: "nope" }]) {
      const res = await rehire(ctx.token, ctx.exit, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ mainProjectId: "mainProjectActive" }));
      expect(res.body.errors.mainProjectId).toBe("Select an active main project.");
    }
    expect((await employeeOf(ctx)).employment_status).toBe("EXITED");
  });

  it("secondary projects ended at the LWD are not restored", async () => {
    const ctx = await employeeSetup();
    const second = await createProject(ctx.employer, { start_date: "2026-01-01" });
    const leaver = await add(ctx, { projectIds: [ctx.project.id, second.id] });
    const exit = await exitEmployee(ctx, leaver);
    expect((await rehire(ctx.token, exit)).status).toBe(200);
    const rows = await activeProjects({ leaver });
    expect(rows.map((r) => r.project_id)).toEqual([ctx.project.id]);
    expect((await db.EmployeeProject.findOne({ where: { employee_id: leaver.id, project_id: second.id } })).is_active).toBe(false);
  });
});

describe("kept setup: approval group, shift, salary, leave", () => {
  it("an active approval group, shift, salary and leave policies are kept; salary from the rehire date; balances fresh", async () => {
    const ctx = await employeeSetup();
    const shift = await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Day", start_time: "08:00:00", end_time: "17:00:00" });
    const upfront = await createLeavePolicy(ctx.employer, { accrual_method: "UPFRONT", monthly_accrual: 0, prorate_joiners: false });
    const leaver = await add(ctx, { shiftId: shift.id, leavePolicyIds: [ctx.policy.id, upfront.id] });
    const exit = await exitEmployee(ctx, leaver);
    // Approval group set after the exit (the leaver's exit went to the owner).
    const group = await db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: "Site HR", group_code: "SHR", module_key: "ALL" });
    await db.EmployeeApprovalRouting.create({ employer_id: ctx.employer.id, employee_id: leaver.id, module_key: "ALL", approval_group_id: group.id });
    // Leave used before leaving.
    await db.LeaveBalance.update({ consumed_balance: 3, available_balance: 18 }, { where: { employee_id: leaver.id, leave_policy_id: upfront.id } });

    const res = await rehire(ctx.token, exit, { rehireDate: "2026-11-01" });
    expect(res.status).toBe(200);
    expect(res.body.data.approval_group_id).toBe(group.id);
    expect(await db.EmployeeApprovalRouting.count({ where: { employee_id: leaver.id, approval_group_id: group.id } })).toBe(1);

    expect((await db.Employee.findByPk(leaver.id)).shift_id).toBe(shift.id);
    const shifts = await db.EmployeeShiftHistory.findAll({ where: { employee_id: leaver.id }, order: [["effective_from", "ASC"]], raw: true });
    expect(shifts.map((s) => [s.shift_id, s.effective_from])).toEqual([
      [shift.id, "2026-03-01"],
      [shift.id, "2026-11-01"],
    ]);

    const salaries = await db.EmployeeSalary.findAll({ where: { employee_id: leaver.id }, order: [["effective_from", "ASC"]], raw: true });
    expect(salaries.map((s) => [s.effective_from, s.effective_to, Boolean(s.is_active), s.salary_calc_mode])).toEqual([
      ["2026-03-01", "2026-10-15", false, "MONTHLY_FIXED"],
      ["2026-11-01", null, true, "MONTHLY_FIXED"],
    ]);
    const parts = await db.EmployeeSalaryComponent.findAll({ where: { employee_salary_id: salaries[1].id }, raw: true });
    expect(parts.map((p) => [p.salary_component_id, Number(p.amount)]).sort()).toEqual(
      [
        [ctx.components.BASIC.id, 5000],
        [ctx.components.HOUSING.id, 1250],
        [ctx.components.TRANSPORT.id, 500],
      ].sort()
    );

    const policies = await db.EmployeeLeavePolicy.findAll({ where: { employee_id: leaver.id, is_active: true }, raw: true });
    expect(policies.map((p) => [p.leave_policy_id, p.effective_from]).sort()).toEqual(
      [
        [ctx.policy.id, "2026-11-01"],
        [upfront.id, "2026-11-01"],
      ].sort()
    );
    const balance = await db.LeaveBalance.findOne({ where: { employee_id: leaver.id, leave_policy_id: upfront.id } });
    expect(Number(balance.consumed_balance)).toBe(0);
    expect(Number(balance.available_balance)).toBe(21);
  });

  it("an inactive approval group, a deleted shift and an inactive leave policy are not kept", async () => {
    const ctx = await employeeSetup();
    const shift = await db.CompanyShift.create({ employer_id: ctx.employer.id, name: "Night", start_time: "20:00:00", end_time: "05:00:00" });
    const extra = await createLeavePolicy(ctx.employer);
    const leaver = await add(ctx, { shiftId: shift.id, leavePolicyIds: [ctx.policy.id, extra.id] });
    const exit = await exitEmployee(ctx, leaver);
    const group = await db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: "Old HR", group_code: "OHR", module_key: "ALL", is_active: false });
    await db.EmployeeApprovalRouting.create({ employer_id: ctx.employer.id, employee_id: leaver.id, module_key: "ALL", approval_group_id: group.id });
    await shift.destroy();
    await extra.update({ is_active: false });

    const res = await rehire(ctx.token, exit);
    expect(res.status).toBe(200);
    expect(res.body.data.approval_group_id).toBeNull();
    expect(await db.EmployeeApprovalRouting.count({ where: { employee_id: leaver.id } })).toBe(0);
    expect((await db.Employee.findByPk(leaver.id)).shift_id).toBeNull();
    const policies = await db.EmployeeLeavePolicy.findAll({ where: { employee_id: leaver.id, is_active: true }, raw: true });
    expect(policies.map((p) => p.leave_policy_id)).toEqual([ctx.policy.id]);
  });
});

describe("job fields", () => {
  const jobSetup = async () => {
    const ctx = await employeeSetup();
    const department = await db.Department.create({ employer_id: ctx.employer.id, name: "Civil", code: `CIV${phoneNo}` });
    const designation = await db.Designation.create({ employer_id: ctx.employer.id, department_id: department.id, name: "Engineer" });
    const staffing = await db.StaffingCompany.create({ employer_id: ctx.employer.id, name: "Gulf Manpower", code: `GM${phoneNo}` });
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: `Site staff ${phoneNo}` });
    const leaver = await add(ctx, {
      employmentType: "CONTRACT",
      staffingCompanyId: staffing.id,
      salaryMode: "HOURLY",
      hourlyRate: 25,
      components: [],
      departmentId: department.id,
      designationId: designation.id,
      roleId: role.id,
    });
    const exit = await exitEmployee(ctx, leaver);
    return { ...ctx, leaver, exit, department, designation, staffing, role };
  };

  it("employment type, role, department, designation and staffing company are kept when still active", async () => {
    const ctx = await jobSetup();
    expect((await rehire(ctx.token, ctx.exit)).status).toBe(200);
    expect(await employeeOf(ctx)).toMatchObject({
      employment_type: "CONTRACT",
      department_id: ctx.department.id,
      designation_id: ctx.designation.id,
      staffing_company_id: ctx.staffing.id,
    });
    expect((await accountOf(ctx)).role_id).toBe(ctx.role.id);
  });

  it("an inactive department (with its designation), staffing company and a deleted role are cleared", async () => {
    const ctx = await jobSetup();
    await ctx.department.update({ status: "INACTIVE" });
    await ctx.staffing.update({ status: "INACTIVE" });
    await ctx.role.destroy();
    expect((await rehire(ctx.token, ctx.exit)).status).toBe(200);
    expect(await employeeOf(ctx)).toMatchObject({ employment_type: "CONTRACT", department_id: null, designation_id: null, staffing_company_id: null });
    expect((await accountOf(ctx)).role_id).toBeNull();
  });

  it("an inactive designation alone is cleared; the department stays", async () => {
    const ctx = await jobSetup();
    await ctx.designation.update({ status: "INACTIVE" });
    expect((await rehire(ctx.token, ctx.exit)).status).toBe(200);
    expect(await employeeOf(ctx)).toMatchObject({ department_id: ctx.department.id, designation_id: null });
  });

  it("any of them can be overridden under the create rules", async () => {
    const ctx = await jobSetup();
    const civil2 = await db.Department.create({ employer_id: ctx.employer.id, name: "MEP", code: `MEP${phoneNo}` });
    const inactive = await db.Department.create({ employer_id: ctx.employer.id, name: "Old", code: `OLD${phoneNo}`, status: "INACTIVE" });

    let res = await rehire(ctx.token, ctx.exit, { departmentId: inactive.id });
    expect(res.body).toEqual(validationBody({ departmentId: "departmentActive" }));
    res = await rehire(ctx.token, ctx.exit, { employmentType: "FULL_TIME" });
    expect(res.body).toEqual(validationBody({ staffingCompanyId: "staffingContractOnly" }));
    res = await rehire(ctx.token, ctx.exit, { roleId: MISSING_ID });
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
    expect((await employeeOf(ctx)).employment_status).toBe("EXITED");

    res = await rehire(ctx.token, ctx.exit, { departmentId: civil2.id, designationId: null, staffingCompanyId: null, roleId: null, employmentType: "CONTRACT", accessLevel: "GENERAL_EMPLOYEE" });
    expect(res.status).toBe(200);
    expect(await employeeOf(ctx)).toMatchObject({ department_id: civil2.id, designation_id: null, staffing_company_id: null });
    expect(await accountOf(ctx)).toMatchObject({ role_id: null, access_level: "GENERAL_EMPLOYEE" });
  });
});

describe("access level", () => {
  const subAdminSetup = async () => {
    const ctx = await employeeSetup();
    const role = await db.Role.create({ employer_id: ctx.employer.id, name: `HR lead ${phoneNo}` });
    const leaver = await add(ctx, { accessLevel: "SUB_ADMIN", roleId: role.id });
    const exit = await exitEmployee(ctx, leaver);
    return { ...ctx, leaver, exit, role };
  };

  it("a former SUB_ADMIN stays SUB_ADMIN when the owner rehires them", async () => {
    const ctx = await subAdminSetup();
    const res = await rehire(ctx.token, ctx.exit);
    expect(res.status).toBe(200);
    expect(res.body.data.access_level).toBe("SUB_ADMIN");
    expect(await accountOf(ctx)).toMatchObject({ access_level: "SUB_ADMIN", role_id: ctx.role.id });
  });

  it("…and becomes EMPLOYEE when someone else does; they can't choose SUB_ADMIN", async () => {
    const ctx = await subAdminSetup();
    const hr = await loginFor(ctx.employer, "SUB_ADMIN", CREATOR);
    expect((await rehire(hr.token, ctx.exit, { accessLevel: "SUB_ADMIN" })).body).toEqual(errorBody("FORBIDDEN"));
    const res = await rehire(hr.token, ctx.exit);
    expect(res.status).toBe(200);
    expect(await accountOf(ctx)).toMatchObject({ access_level: "EMPLOYEE", role_id: ctx.role.id });
  });

  it("access level ADMIN → ACCOUNT_ADMIN_EXISTS; STAFFING_COMPANY → field error", async () => {
    const ctx = await setup();
    expect((await rehire(ctx.token, ctx.exit, { accessLevel: "ADMIN" })).body).toEqual(errorBody("ACCOUNT_ADMIN_EXISTS"));
    expect((await rehire(ctx.token, ctx.exit, { accessLevel: "STAFFING_COMPANY" })).body).toEqual(validationBody({ accessLevel: "accessLevelInvalid" }));
  });
});

describe("refusals", () => {
  it("the email has a current account in another company → 409 ACCOUNT_EMAIL_IN_OTHER_COMPANY", async () => {
    const ctx = await setup();
    const other = await employeeSetup();
    const userId = (await employeeOf(ctx)).user_id;
    await db.HrmsAccount.create({ user_id: userId, employer_id: other.employer.id, access_level: "EMPLOYEE", status: "ACTIVE" });
    const res = await rehire(ctx.token, ctx.exit);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("ACCOUNT_EMAIL_IN_OTHER_COMPANY"));
    expect(res.body.message).toBe("This email is already used by another company.");
    expect((await accountOf(ctx)).status).toBe("INACTIVE");
  });

  it("an exit that isn't EXITED, or one already rehired → 409 EXIT_INVALID_STATE", async () => {
    const ctx = await employeeSetup();
    const pendingLeaver = await add(ctx, { name: "Pending Leaver" });
    const pending = await api.post(`/api/employees/${pendingLeaver.id}/exits`, ctx.token, exitTerms({ lastWorkingDay: "2026-12-01" }));
    const noticeLeaver = await add(ctx, { name: "Notice Leaver" });
    const inNotice = await exitEmployee(ctx, noticeLeaver, { noticeStartDate: TODAY, lastWorkingDay: "2026-12-01" });
    expect(inNotice.status).toBe("IN_NOTICE");
    const exitedLeaver = await add(ctx, { name: "Exited Leaver" });
    const exited = await exitEmployee(ctx, exitedLeaver);
    expect((await rehire(ctx.token, exited)).status).toBe(200);

    for (const id of [pending.body.data.id, inNotice.id, exited.id]) {
      const res = await rehire(ctx.token, id);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("EXIT_INVALID_STATE"));
      expect(res.body.message).toBe("This action isn't possible in the exit's current status.");
    }
    expect(await db.ExitEvent.count({ where: { exit_id: exited.id, event_type: "REHIRED" } })).toBe(1);
  });

  it("FORBIDDEN without employee:create; STAFFING_COMPANY → 403; no token → 401", async () => {
    const ctx = await setup();
    for (const modules of [{ employee: { can_read: true, can_update: true } }, { exit: { can_read: true, can_update: true } }]) {
      const { token } = await loginFor(ctx.employer, "SUB_ADMIN", modules);
      expect((await rehire(token, ctx.exit)).body).toEqual(errorBody("FORBIDDEN"));
    }
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", CREATOR)).token;
    expect((await rehire(staffing, ctx.exit)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await rehire(null, ctx.exit)).status).toBe(401);
    expect((await employeeOf(ctx)).employment_status).toBe("EXITED");
    const hr = await loginFor(ctx.employer, "EMPLOYEE", CREATOR);
    expect((await rehire(hr.token, ctx.exit)).status).toBe(200);
  });

  it("another company's or an unknown exit → 404 NOT_FOUND", async () => {
    const ctx = await setup();
    const other = await employeeSetup();
    for (const id of [ctx.exit.id, MISSING_ID, "nope"]) {
      expect((await rehire(other.token, id)).body).toEqual(errorBody("NOT_FOUND"));
    }
    expect((await employeeOf(ctx)).employment_status).toBe("EXITED");
  });
});
