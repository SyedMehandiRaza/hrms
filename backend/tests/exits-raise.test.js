const bcrypt = require("bcrypt");
const { db, PASSWORD, MISSING_ID, errorBody, validationBody, loginAs, loginFor, createRole, api, NO_FLAGS } = require("./helpers/api");
const { employeeSetup, createdEmployee } = require("./helpers/employees");
const { clock } = require("../src/utils/clock");

// Raise exit + exit list/detail + exit settings API (ticket workforce#16a; workforce D58, D61,
// D62, D66; standards §7.2 "Exit (raise, edit terms)", "Exit settings").

const TODAY = "2026-10-21";

beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const BOTH = { employee: { can_create: true, can_update: true } };
let phoneNo = 4000;
const add = (ctx, overrides = {}) =>
  createdEmployee(ctx, { phone: `05015${String((phoneNo += 1)).padStart(5, "0")}`, joiningDate: "2026-03-01", ...overrides });

// A login for an employee created through the API, as if they had set their own password.
const loginOf = async (employeeId) => {
  const employee = await db.Employee.findByPk(employeeId);
  await db.User.update({ password: await bcrypt.hash(PASSWORD, 4) }, { where: { id: employee.user_id } });
  await db.HrmsAccount.update({ password_setup_required: false, password_setup_token_hash: null }, { where: { user_id: employee.user_id } });
  return loginAs((await db.User.findByPk(employee.user_id)).email);
};
// An employee who can raise exits for others (employee:create + update).
const hrOfficer = async (ctx) => {
  const role = await createRole(ctx.employer, BOTH);
  const hr = await add(ctx, { roleId: role.id, accessLevel: "EMPLOYEE" });
  return { ...hr, token: await loginOf(hr.id) };
};

const termination = (overrides = {}) => ({
  exitType: "TERMINATION",
  reasonCategory: "PERFORMANCE",
  reason: "Repeated missed targets over two quarters.",
  noticeStartDate: TODAY,
  noticeDays: 30,
  ...overrides,
});
const raise = (token, employee, body) => api.post(`/api/employees/${employee.id || employee}/exits`, token, body);

describe("POST /api/employees/:id/exits — termination by someone else", () => {
  it("→ exit PENDING_APPROVAL, EXIT request to the employee's group, RAISED event; the employee stays ACTIVE with their login", async () => {
    const ctx = await employeeSetup();
    const approver = await add(ctx);
    const group = await db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: "Exits", group_code: "EX", module_key: "ALL" });
    await db.ApprovalGroupMember.create({ approval_group_id: group.id, employee_id: approver.id, level_no: 1, is_mandatory: true });
    const leaver = await add(ctx, { approvalGroupId: group.id });
    const res = await raise(ctx.token, leaver, termination({ encashLeave: false, loanHandling: "RECOVER", rehireEligible: true, coolingPeriodDays: 365 }));
    expect(res.status).toBe(201);
    const exit = await db.EmployeeExit.findByPk(res.body.data.id);
    expect(exit).toMatchObject({
      employer_id: ctx.employer.id,
      employee_id: leaver.id,
      exit_type: "TERMINATION",
      reason_category: "PERFORMANCE",
      status: "PENDING_APPROVAL",
      notice_start_date: TODAY,
      notice_days: 30,
      original_last_working_day: "2026-11-19",
      last_working_day: "2026-11-19",
      encash_leave: false,
      loan_handling: "RECOVER",
      rehire_eligible: true,
      cooling_period_days: 365,
      raised_by: ctx.owner.id,
    });
    const request = await db.ApprovalRequest.findByPk(exit.approval_request_id);
    expect(request).toMatchObject({ entity_type: "EXIT", entity_id: exit.id, approval_group_id: group.id, final_status: "PENDING", subject_employee_id: leaver.id });
    const events = await db.ExitEvent.findAll({ where: { exit_id: exit.id }, raw: true });
    expect(events.map((e) => [e.event_type, e.actor_user_id])).toEqual([["RAISED", ctx.owner.id]]);
    expect((await db.Employee.findByPk(leaver.id)).employment_status).toBe("ACTIVE");
    const account = await db.HrmsAccount.findOne({ where: { user_id: (await db.Employee.findByPk(leaver.id)).user_id } });
    expect(account.status).toBe("ACTIVE");
    expect(res.body.data).toMatchObject({ id: exit.id, status: "PENDING_APPROVAL", last_working_day: "2026-11-19" });
  });

  it("an employee with no group → an owner-only request", async () => {
    const ctx = await employeeSetup();
    const leaver = await add(ctx);
    const res = await raise(ctx.token, leaver, termination());
    const exit = await db.EmployeeExit.findByPk(res.body.data.id);
    expect((await db.ApprovalRequest.findByPk(exit.approval_request_id)).approval_group_id).toBeNull();
  });

  it("LWD defaults to start + days − 1; 0 notice days → LWD = start; a given LWD is kept", async () => {
    const ctx = await employeeSetup();
    const lwdOf = async (body) => (await raise(ctx.token, await add(ctx), termination(body))).body.data.last_working_day;
    expect(await lwdOf({ noticeDays: 1 })).toBe(TODAY);
    expect(await lwdOf({ noticeDays: 0 })).toBe(TODAY);
    expect(await lwdOf({ noticeStartDate: "2026-11-01", noticeDays: 10 })).toBe("2026-11-10");
    expect(await lwdOf({ noticeDays: 30, lastWorkingDay: "2026-12-31" })).toBe("2026-12-31");
  });

  it("notice days and settlement default from Exit settings", async () => {
    const ctx = await employeeSetup();
    await db.ExitSetting.create({ employer_id: ctx.employer.id, default_notice_days: 60, default_cooling_days: 90, default_encash_leave: false, default_allow_leave_during_notice: true });
    const res = await raise(ctx.token, await add(ctx), termination({ noticeDays: undefined }));
    expect(res.body.data).toMatchObject({ notice_days: 60, last_working_day: "2026-12-19", cooling_period_days: 90, encash_leave: false, allow_leave_during_notice: true, rehire_eligible: false, loan_handling: "NONE" });
  });

  it("a user with employee:create + update (not the owner) can raise it", async () => {
    const ctx = await employeeSetup();
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", BOTH);
    expect((await raise(token, await add(ctx), termination())).status).toBe(201);
  });

  it.each([
    ["only employee:create", { employee: { can_create: true } }],
    ["only employee:update", { employee: { can_update: true } }],
  ])("%s → 403 FORBIDDEN (also for a resignation for someone else)", async (_label, modules) => {
    const ctx = await employeeSetup();
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", modules);
    const leaver = await add(ctx);
    expect((await raise(token, leaver, termination())).body).toEqual(errorBody("FORBIDDEN"));
    expect((await raise(token, leaver, termination({ exitType: "RESIGNATION", reasonCategory: "PERSONAL" }))).body).toEqual(errorBody("FORBIDDEN"));
  });

  it("a STAFFING_COMPANY login → 403; no token → 401", async () => {
    const ctx = await employeeSetup();
    const leaver = await add(ctx);
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", BOTH)).token;
    expect((await raise(staffing, leaver, termination())).body).toEqual(errorBody("FORBIDDEN"));
    expect((await raise(null, leaver, termination())).status).toBe(401);
  });

  it("raising a termination for yourself → employeeId 'You cannot raise an exit for yourself'", async () => {
    const ctx = await employeeSetup();
    const hr = await hrOfficer(ctx);
    const res = await raise(hr.token, hr, termination());
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ employeeId: "exitEmployeeSelf" }));
  });

  it("the owner can't be the subject (no employee record → 404); another company's or unknown employee → 404", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const theirs = await add(other);
    for (const id of [ctx.owner.id, theirs.id, MISSING_ID, "nope"]) {
      expect((await raise(ctx.token, id, termination())).body).toEqual(errorBody("NOT_FOUND"));
    }
  });

  it("an exited employee → employeeId 'Select a valid employee'", async () => {
    const ctx = await employeeSetup();
    const leaver = await add(ctx);
    await db.Employee.update({ employment_status: "EXITED" }, { where: { id: leaver.id } });
    expect((await raise(ctx.token, leaver, termination())).body).toEqual(validationBody({ employeeId: "exitEmployeeInvalid" }));
  });

  it("a second open exit → 409 EXIT_ALREADY_OPEN; two raises at once → one wins, the other gets EXIT_ALREADY_OPEN", async () => {
    const ctx = await employeeSetup();
    const leaver = await add(ctx);
    expect((await raise(ctx.token, leaver, termination())).status).toBe(201);
    const again = await raise(ctx.token, leaver, termination());
    expect(again.status).toBe(409);
    expect(again.body).toEqual(errorBody("EXIT_ALREADY_OPEN"));
    expect(again.body.message).toBe("This employee already has an open exit.");

    const racer = await add(ctx);
    const results = await Promise.all([raise(ctx.token, racer, termination()), raise(ctx.token, racer, termination())]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409).body).toEqual(errorBody("EXIT_ALREADY_OPEN"));
    expect(await db.EmployeeExit.count({ where: { employee_id: racer.id } })).toBe(1);
  });

  it("a closed exit (REJECTED or CANCELLED) doesn't block a new one", async () => {
    const ctx = await employeeSetup();
    const leaver = await add(ctx);
    const first = await raise(ctx.token, leaver, termination());
    await db.EmployeeExit.update({ status: "REJECTED" }, { where: { id: first.body.data.id } });
    expect((await raise(ctx.token, leaver, termination())).status).toBe(201);
  });
});

describe("POST /api/employees/:id/exits — field rules (§7.2)", () => {
  it.each([
    ["no type", { exitType: undefined }, { exitType: "exitTypeRequired" }],
    ["unknown type", { exitType: "RETIREMENT" }, { exitType: "exitTypeRequired" }],
    ["no reason category", { reasonCategory: undefined }, { reasonCategory: "exitReasonCategory" }],
    ["a resignation reason on a termination", { reasonCategory: "BETTER_OPPORTUNITY" }, { reasonCategory: "exitReasonCategory" }],
    ["a termination reason on a resignation", { exitType: "RESIGNATION", reasonCategory: "ABSCONDING" }, { reasonCategory: "exitReasonCategory" }],
    ["reason under 10", { reason: "Too short" }, { reason: "exitReason" }],
    ["reason over 1000", { reason: "x".repeat(1001) }, { reason: "exitReason" }],
    ["notice days -1", { noticeDays: -1 }, { noticeDays: "noticeDays" }],
    ["notice days 181", { noticeDays: 181 }, { noticeDays: "noticeDays" }],
    ["notice days 1.5", { noticeDays: 1.5 }, { noticeDays: "noticeDays" }],
    ["notice start 91 days ago", { noticeStartDate: "2026-07-22" }, { noticeStartDate: "noticeStartInvalid" }],
    ["notice start 91 days ahead", { noticeStartDate: "2027-01-20" }, { noticeStartDate: "noticeStartInvalid" }],
    ["notice start not a date", { noticeStartDate: "2026-02-30" }, { noticeStartDate: "noticeStartInvalid" }],
    ["LWD not a date", { lastWorkingDay: "soon" }, { lastWorkingDay: "lwdInvalid" }],
    ["LWD before the notice start", { noticeStartDate: "2026-11-01", lastWorkingDay: "2026-10-31" }, { lastWorkingDay: "lwdBeforeStart" }],
    ["LWD over 365 days after the start", { lastWorkingDay: "2027-10-22" }, { lastWorkingDay: "lwdTooFar" }],
    ["preferred day before the start", { noticeStartDate: "2026-11-01", preferredLastDay: "2026-10-30" }, { preferredLastDay: "preferredDayBeforeStart" }],
    ["encash not yes/no", { encashLeave: "maybe" }, { encashLeave: "yesNo" }],
    ["rehire not yes/no", { rehireEligible: "sometimes" }, { rehireEligible: "yesNo" }],
    ["unknown loan handling", { loanHandling: "FORGET" }, { loanHandling: "loanHandling" }],
    ["cooling -1", { coolingPeriodDays: -1 }, { coolingPeriodDays: "coolingDays" }],
    ["cooling 1096", { coolingPeriodDays: 1096 }, { coolingPeriodDays: "coolingDays" }],
  ])("%s → 400", async (_label, overrides, fields) => {
    const ctx = await employeeSetup();
    const res = await raise(ctx.token, await add(ctx), termination(overrides));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(fields));
  });

  it("boundaries: notice start exactly ±90 days, LWD exactly start + 365, notice 0 and 180, cooling 0 and 1095 are fine", async () => {
    const ctx = await employeeSetup();
    for (const body of [
      { noticeStartDate: "2026-07-23", lastWorkingDay: TODAY },
      { noticeStartDate: "2027-01-19" },
      { lastWorkingDay: "2027-10-21" },
      { noticeDays: 0, coolingPeriodDays: 0 },
      { noticeDays: 180, coolingPeriodDays: 1095 },
    ]) {
      expect((await raise(ctx.token, await add(ctx), termination(body))).status).toBe(201);
    }
  });

  it("a non-owner setting an LWD in the past → 'Last working day cannot be in the past'; the owner can (absconding, 0 days)", async () => {
    const ctx = await employeeSetup();
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", BOTH);
    const past = { noticeStartDate: "2026-10-01", noticeDays: 0, lastWorkingDay: "2026-10-01" };
    expect((await raise(token, await add(ctx), termination(past))).body).toEqual(validationBody({ lastWorkingDay: "lwdPast" }));
    const res = await raise(ctx.token, await add(ctx), termination({ ...past, reasonCategory: "ABSCONDING" }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ last_working_day: "2026-10-01", reason_category: "ABSCONDING" });
  });
});

describe("own resignation (D66)", () => {
  it("a login with an ACTIVE employee record raises its own resignation; notice days from Exit settings", async () => {
    const ctx = await employeeSetup();
    await db.ExitSetting.create({ employer_id: ctx.employer.id, default_notice_days: 45 });
    const me = await add(ctx, { accessLevel: "GENERAL_EMPLOYEE" });
    const token = await loginOf(me.id);
    const res = await raise(token, "me", { exitType: "RESIGNATION", reasonCategory: "RELOCATION", reason: "Moving back home with my family.", preferredLastDay: "2026-11-30", noticeDays: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ employee: { id: me.id }, exit_type: "RESIGNATION", notice_start_date: TODAY, notice_days: 45, last_working_day: "2026-12-04", preferred_last_day: "2026-11-30" });
    const exit = await db.EmployeeExit.findByPk(res.body.data.id);
    const request = await db.ApprovalRequest.findByPk(exit.approval_request_id);
    expect(request.requested_by_user_id).toBe((await db.Employee.findByPk(me.id)).user_id);
    // Its own id works the same.
    const other = await add(ctx);
    const own = await raise(await loginOf(other.id), other, { exitType: "RESIGNATION", reasonCategory: "PERSONAL", reason: "Personal reasons at home." });
    expect(own.status).toBe(201);
  });

  it("an IN_NOTICE employee can't resign again (EXIT_ALREADY_OPEN) — the open exit blocks it", async () => {
    const ctx = await employeeSetup();
    const me = await add(ctx);
    const token = await loginOf(me.id);
    const body = { exitType: "RESIGNATION", reasonCategory: "PERSONAL", reason: "Personal reasons at home." };
    expect((await raise(token, "me", body)).status).toBe(201);
    expect((await raise(token, "me", body)).body).toEqual(errorBody("EXIT_ALREADY_OPEN"));
  });

  it("a plain employee can't raise for someone else or terminate themselves", async () => {
    const ctx = await employeeSetup();
    const me = await add(ctx);
    const other = await add(ctx);
    const token = await loginOf(me.id);
    expect((await raise(token, other, { exitType: "RESIGNATION", reasonCategory: "PERSONAL", reason: "Personal reasons at home." })).body).toEqual(errorBody("FORBIDDEN"));
    expect((await raise(token, "me", termination())).body).toEqual(validationBody({ employeeId: "exitEmployeeSelf" }));
  });

  it("the owner (no employee record) or a STAFFING_COMPANY login → 403", async () => {
    const ctx = await employeeSetup();
    const body = { exitType: "RESIGNATION", reasonCategory: "PERSONAL", reason: "Personal reasons at home." };
    expect((await raise(ctx.token, "me", body)).body).toEqual(errorBody("FORBIDDEN"));
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", BOTH)).token;
    expect((await raise(staffing, "me", body)).body).toEqual(errorBody("FORBIDDEN"));
  });
});

describe("GET /api/exits and /api/exits/:id", () => {
  const seed = async () => {
    const ctx = await employeeSetup();
    const a = await add(ctx, { name: "Ahmed Ali" });
    const b = await add(ctx, { name: "Bilal Khan" });
    const c = await add(ctx, { name: "Chand Bibi" });
    const ea = (await raise(ctx.token, a, termination({ reasonCategory: "MISCONDUCT", noticeDays: 10 }))).body.data;
    const eb = (await raise(ctx.token, b, termination({ exitType: "RESIGNATION", reasonCategory: "HEALTH", noticeDays: 60 }))).body.data;
    const ec = (await raise(ctx.token, c, termination({ noticeDays: 30 }))).body.data;
    await db.EmployeeExit.update({ status: "IN_NOTICE" }, { where: { id: ec.id } });
    return { ctx, ea, eb, ec };
  };

  it("lists the company's exits with filters: status, type, reason, LWD month, search", async () => {
    const { ctx, ea, eb, ec } = await seed();
    const other = await employeeSetup();
    await raise(other.token, await add(other), termination());
    const ids = async (query) => (await api.get("/api/exits", ctx.token, { query })).body.data.items.map((i) => i.id).sort();
    expect(await ids({})).toEqual([ea.id, eb.id, ec.id].sort());
    expect(await ids({ status: "IN_NOTICE" })).toEqual([ec.id]);
    expect(await ids({ status: "PENDING_APPROVAL" })).toEqual([ea.id, eb.id].sort());
    expect(await ids({ type: "RESIGNATION" })).toEqual([eb.id]);
    expect(await ids({ reason: "MISCONDUCT" })).toEqual([ea.id]);
    expect(await ids({ lwdMonth: "2026-12" })).toEqual([eb.id]);
    expect(await ids({ lwdMonth: "2026-10" })).toEqual([ea.id]);
    expect(await ids({ search: "bilal" })).toEqual([eb.id]);
    expect(await ids({ search: "EMP-0003" })).toEqual([ec.id]);
    const item = (await api.get("/api/exits", ctx.token, { query: { search: "Ahmed" } })).body.data.items[0];
    expect(item).toMatchObject({
      id: ea.id,
      employee: { id: expect.any(String), name: "Ahmed Ali", employee_code: "EMP-0001" },
      exit_type: "TERMINATION",
      reason_category: "MISCONDUCT",
      status: "PENDING_APPROVAL",
      notice_start_date: TODAY,
      last_working_day: "2026-10-30",
    });
    for (const [query, field] of [
      [{ status: "GONE" }, "status"],
      [{ lwdMonth: "2026-13" }, "lwdMonth"],
      [{ type: "RETIRE" }, "type"],
    ]) {
      expect((await api.get("/api/exits", ctx.token, { query })).body).toEqual(validationBody({ [field]: "VALIDATION_FAILED" }));
    }
  });

  it("detail returns the terms, settlement choices, approval and events; another company's → 404", async () => {
    const { ctx, ea } = await seed();
    const res = await api.get(`/api/exits/${ea.id}`, ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: ea.id,
      exit_type: "TERMINATION",
      reason: "Repeated missed targets over two quarters.",
      notice_days: 10,
      original_last_working_day: "2026-10-30",
      encash_leave: true,
      loan_handling: "NONE",
      approval_request_id: expect.any(String),
      raised_by: { id: ctx.owner.id, name: ctx.owner.name },
    });
    expect(res.body.data.events.map((e) => e.event_type)).toEqual(["RAISED"]);
    const other = await employeeSetup();
    for (const id of [ea.id, MISSING_ID, "nope"]) {
      expect((await api.get(`/api/exits/${id}`, other.token)).body).toEqual(errorBody("NOT_FOUND"));
    }
  });

  it("list and detail need exit:read; staffing → 403", async () => {
    const { ctx, ea } = await seed();
    const none = (await loginFor(ctx.employer, "SUB_ADMIN", { exit: { ...NO_FLAGS, can_update: true }, employee: { can_read: true } })).token;
    expect((await api.get("/api/exits", none)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await api.get(`/api/exits/${ea.id}`, none)).body).toEqual(errorBody("FORBIDDEN"));
    const reader = (await loginFor(ctx.employer, "EMPLOYEE", { exit: { can_read: true } })).token;
    expect((await api.get("/api/exits", reader)).status).toBe(200);
    expect((await api.get(`/api/exits/${ea.id}`, reader)).status).toBe(200);
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { exit: { can_read: true } })).token;
    expect((await api.get("/api/exits", staffing)).body).toEqual(errorBody("FORBIDDEN"));
  });
});

describe("GET/PUT /api/exit-settings", () => {
  it("returns the defaults before anything is saved; saving updates them", async () => {
    const ctx = await employeeSetup();
    expect((await api.get("/api/exit-settings", ctx.token)).body.data).toEqual({
      noticeDays: 30,
      coolingPeriodDays: 180,
      allowLeaveDuringNotice: false,
      encashLeave: true,
      blockLoansDuringNotice: true,
    });
    const body = { noticeDays: 0, coolingPeriodDays: 1095, allowLeaveDuringNotice: true, encashLeave: false, blockLoansDuringNotice: false };
    const res = await api.put("/api/exit-settings", ctx.token, body);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(body);
    expect((await api.get("/api/exit-settings", ctx.token)).body.data).toEqual(body);
    expect(await db.ExitSetting.count({ where: { employer_id: ctx.employer.id } })).toBe(1);
    expect((await api.put("/api/exit-settings", ctx.token, { ...body, noticeDays: 180 })).body.data.noticeDays).toBe(180);
  });

  it.each([
    [{ noticeDays: 181 }, { noticeDays: "noticeDays" }],
    [{ noticeDays: -1 }, { noticeDays: "noticeDays" }],
    [{ coolingPeriodDays: 1096 }, { coolingPeriodDays: "coolingDays" }],
    [{ coolingPeriodDays: "x" }, { coolingPeriodDays: "coolingDays" }],
    [{ encashLeave: "maybe" }, { encashLeave: "yesNo" }],
  ])("%j → 400", async (change, fields) => {
    const ctx = await employeeSetup();
    const body = { noticeDays: 30, coolingPeriodDays: 180, allowLeaveDuringNotice: false, encashLeave: true, blockLoansDuringNotice: true, ...change };
    expect((await api.put("/api/exit-settings", ctx.token, body)).body).toEqual(validationBody(fields));
  });

  it("read needs exit:read, update needs exit:update; each company has its own", async () => {
    const ctx = await employeeSetup();
    const other = await employeeSetup();
    const body = { noticeDays: 10, coolingPeriodDays: 10, allowLeaveDuringNotice: false, encashLeave: true, blockLoansDuringNotice: true };
    const reader = (await loginFor(ctx.employer, "SUB_ADMIN", { exit: { can_read: true } })).token;
    expect((await api.get("/api/exit-settings", reader)).status).toBe(200);
    expect((await api.put("/api/exit-settings", reader, body)).body).toEqual(errorBody("FORBIDDEN"));
    const updater = (await loginFor(ctx.employer, "SUB_ADMIN", { exit: { can_update: true } })).token;
    expect((await api.put("/api/exit-settings", updater, body)).status).toBe(200);
    expect((await api.get("/api/exit-settings", updater)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await api.get("/api/exit-settings", other.token)).body.data.noticeDays).toBe(30);
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { exit: { can_read: true, can_update: true } })).token;
    expect((await api.get("/api/exit-settings", staffing)).body).toEqual(errorBody("FORBIDDEN"));
  });
});
