const bcrypt = require("bcrypt");
const cron = require("node-cron");
const { db, PASSWORD, errorBody, loginAs, createProject, assign, api } = require("./helpers/api");
const { employeeSetup, createdEmployee, createEmployeeVia } = require("./helpers/employees");
const mailer = require("../src/services/mailer");
const { clock } = require("../src/utils/clock");
const { runLwdJob } = require("../src/services/lwdJob.service");
const { startJobs } = require("../src/jobs");

// The last-working-day job and the shared "process exit" service (ticket workforce#18; workforce
// D59, D63, D22a, D26).

const TODAY = "2026-10-21";
const LWD = TODAY;
// The day after the LWD, early morning in Riyadh (UTC+3).
const NEXT_DAY = new Date("2026-10-22T05:00:00Z");
process.env.MAIL_DRIVER = "memory";

beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

let phoneNo = 7000;
const add = (ctx, overrides = {}) =>
  createdEmployee(ctx, { phone: `05017${String((phoneNo += 1)).padStart(5, "0")}`, joiningDate: "2026-03-01", ...overrides });

const userOf = async (employeeId) => db.User.findByPk((await db.Employee.findByPk(employeeId)).user_id);
const loginOf = async (employeeId) => {
  const user = await userOf(employeeId);
  await db.User.update({ password: await bcrypt.hash(PASSWORD, 4) }, { where: { id: user.id } });
  await db.HrmsAccount.update({ password_setup_required: false, password_setup_token_hash: null }, { where: { user_id: user.id } });
  return loginAs(user.email);
};
const person = async (ctx, overrides) => {
  const employee = await add(ctx, overrides);
  return { ...employee, user: await userOf(employee.id), token: await loginOf(employee.id) };
};

const termination = (overrides = {}) => ({
  exitType: "TERMINATION",
  reasonCategory: "PERFORMANCE",
  reason: "Repeated missed targets over two quarters.",
  noticeStartDate: TODAY,
  noticeDays: 1,
  coolingPeriodDays: 30,
  ...overrides,
});
const raise = async (token, employee, body) => {
  const res = await api.post(`/api/employees/${employee.id || employee}/exits`, token, body);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return db.EmployeeExit.findByPk(res.body.data.id);
};
const approve = async (token, exit, body = {}) => {
  const res = await api.post(`/api/approvals/${exit.approval_request_id}/approve`, token, body);
  if (res.status !== 200) throw new Error(JSON.stringify(res.body));
};
const ownerApprove = (ctx, exit) => approve(ctx.token, exit, { reason: "Approved after review" });
const eventsOf = async (exit) =>
  (await db.ExitEvent.findAll({ where: { exit_id: exit.id }, order: [["created_at", "ASC"]], raw: true })).map((e) => e.event_type);

// Approvers L1 (Lina) and L2 (Lars) on the "Exits" group; the leaver (routed to it) is also on a
// second project, heads a department and approves in two other groups.
const setup = async () => {
  const ctx = await employeeSetup();
  const l1 = await person(ctx, { name: "Lina One" });
  const l2 = await person(ctx, { name: "Lars Two" });
  const group = await db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: "Exits", group_code: "EX", module_key: "ALL", total_levels: 2 });
  await db.ApprovalGroupMember.create({ approval_group_id: group.id, employee_id: l1.id, level_no: 1, is_mandatory: true });
  await db.ApprovalGroupMember.create({ approval_group_id: group.id, employee_id: l2.id, level_no: 2, is_mandatory: true });
  const leaver = await person(ctx, { name: "Sara Leaver", approvalGroupId: group.id });
  const second = await createProject(ctx.employer);
  await assign(await db.Employee.findByPk(leaver.id), second, { start: "2026-04-01" });
  const department = await db.Department.create({ employer_id: ctx.employer.id, name: "Sales", code: "SAL", dept_head_id: leaver.id });
  mailer.clear();
  return { ...ctx, l1, l2, group, leaver, second, department };
};

// The leaver's exit, approved and IN_NOTICE with LWD = today.
const inNotice = async (ctx, overrides) => {
  const exit = await raise(ctx.token, ctx.leaver, termination(overrides));
  await approve(ctx.l1.token, exit);
  await approve(ctx.l2.token, exit);
  expect((await exit.reload()).status).toBe("IN_NOTICE");
  return exit;
};

// A group where the leaver is the only L1 approver (can_skip as given) and Lars is L2, with a
// pending exit request for another employee routed to it, waiting at L1.
const waitingOnLeaver = async (ctx, { canSkip, code }) => {
  const group = await db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: `Group ${code}`, group_code: code, module_key: "ALL", total_levels: 2 });
  await db.ApprovalGroupMember.create({ approval_group_id: group.id, employee_id: ctx.leaver.id, level_no: 1, is_mandatory: true, can_skip: canSkip });
  await db.ApprovalGroupMember.create({ approval_group_id: group.id, employee_id: ctx.l2.id, level_no: 2, is_mandatory: true });
  const other = await add(ctx, { name: `Other ${code}`, approvalGroupId: group.id });
  const exit = await raise(ctx.token, other, termination({ noticeDays: 30 }));
  const request = await db.ApprovalRequest.findByPk(exit.approval_request_id);
  expect(request.current_level).toBe(1);
  return { group, request };
};

describe("runLwdJob — which exits", () => {
  it("processes an IN_NOTICE exit whose LWD is before the company's local today; LWD = today is untouched", async () => {
    const ctx = await setup();
    const exit = await inNotice(ctx);

    await runLwdJob({ now: new Date(`${TODAY}T20:00:00Z`) }); // 23:00 in Riyadh, still the LWD
    expect((await exit.reload()).status).toBe("IN_NOTICE");
    expect((await db.Employee.findByPk(ctx.leaver.id)).employment_status).toBe("IN_NOTICE");

    const result = await runLwdJob({ now: NEXT_DAY });
    expect(result.processed).toContain(exit.id);
    expect((await exit.reload()).status).toBe("EXITED");
  });

  it("leaves a PENDING_APPROVAL exit alone, whatever its LWD", async () => {
    const ctx = await setup();
    const pending = await raise(ctx.token, ctx.leaver, termination());
    await runLwdJob({ now: NEXT_DAY });
    expect((await pending.reload()).status).toBe("PENDING_APPROVAL");
    expect((await db.Employee.findByPk(ctx.leaver.id)).employment_status).toBe("ACTIVE");
  });
});

describe("processing an exit", () => {
  it("exit and employee → EXITED, event EXITED, exit date = LWD, rehire_allowed_from = exit date + cooling days + 1", async () => {
    const ctx = await setup();
    const exit = await inNotice(ctx);
    await runLwdJob({ now: NEXT_DAY });
    await exit.reload();
    expect(exit.status).toBe("EXITED");
    expect(exit.rehire_allowed_from).toBe("2026-11-21");
    expect(exit.exited_at).toEqual(NEXT_DAY);
    expect(await eventsOf(exit)).toEqual(["RAISED", "APPROVED", "EXITED"]);
    const employee = await db.Employee.findByPk(ctx.leaver.id);
    expect(employee).toMatchObject({ employment_status: "EXITED", exit_date: LWD });
    expect((await api.get(`/api/exits/${exit.id}`, ctx.token)).body.data).toMatchObject({ status: "EXITED", rehire_allowed_from: "2026-11-21" });
  });

  it("the account → INACTIVE, every session revoked; the next request → 403 AUTH_ACCOUNT_INACTIVE", async () => {
    const ctx = await setup();
    await inNotice(ctx);
    expect((await api.get("/api/auth/me", ctx.leaver.token)).status).toBe(200);
    await runLwdJob({ now: NEXT_DAY });

    const account = await db.HrmsAccount.findOne({ where: { user_id: ctx.leaver.user.id, employer_id: ctx.employer.id } });
    expect(account.status).toBe("INACTIVE");
    const sessions = await db.HrmsSession.findAll({ where: { hrms_account_id: account.id } });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((s) => s.status === "REVOKED")).toBe(true);

    const res = await api.get("/api/auth/me", ctx.leaver.token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    expect(res.body.message).toBe("Your account is inactive. Contact your administrator.");
    // Others are unaffected.
    expect((await api.get("/api/auth/me", ctx.l1.token)).status).toBe(200);
  });

  it("the email can then be used by another company", async () => {
    const ctx = await setup();
    await inNotice(ctx);
    const elsewhere = await employeeSetup();
    const before = await createEmployeeVia(elsewhere, { email: ctx.leaver.user.email });
    expect(before.body).toEqual(errorBody("ACCOUNT_EMAIL_IN_OTHER_COMPANY"));

    await runLwdJob({ now: NEXT_DAY });
    const after = await createEmployeeVia(elsewhere, { email: ctx.leaver.user.email });
    expect(after.status).toBe(201);
  });

  it("every project assignment and the main period end on the LWD, with REMOVED rows", async () => {
    const ctx = await setup();
    await inNotice(ctx);
    await runLwdJob({ now: NEXT_DAY });

    const rows = await db.EmployeeProject.findAll({ where: { employee_id: ctx.leaver.id } });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toMatchObject({ is_active: false, end_date: LWD });
    expect(rows.find((r) => r.project_id === ctx.project.id)).toMatchObject({ main_project: true, main_project_date_end: LWD });

    const periods = await db.EmployeeMainProjectPeriod.findAll({ where: { employee_id: ctx.leaver.id } });
    expect(periods.map((p) => [p.project_id, p.date_to])).toEqual([[ctx.project.id, LWD]]);

    const removed = await db.EmployeeProjectHistory.findAll({ where: { employee_id: ctx.leaver.id, action: "REMOVED" } });
    expect(removed.map((h) => [h.project_id, h.effective_date]).sort()).toEqual([[ctx.project.id, LWD], [ctx.second.id, LWD]].sort());
    // The project workforce no longer lists them.
    const workforce = (await api.get(`/api/projects/${ctx.second.id}/employees`, ctx.token)).body.data.items;
    expect(workforce.map((e) => e.id)).not.toContain(ctx.leaver.id);
  });

  it("a department they headed has no head", async () => {
    const ctx = await setup();
    await inNotice(ctx);
    await runLwdJob({ now: NEXT_DAY });
    expect((await ctx.department.reload()).dept_head_id).toBeNull();
  });
});

describe("approval groups (D22a, D26)", () => {
  it("their memberships are deactivated", async () => {
    const ctx = await setup();
    const { group } = await waitingOnLeaver(ctx, { canSkip: true, code: "SK" });
    await inNotice(ctx);
    await runLwdJob({ now: NEXT_DAY });
    const memberships = await db.ApprovalGroupMember.findAll({ where: { employee_id: ctx.leaver.id } });
    expect(memberships.map((m) => m.approval_group_id)).toEqual([group.id]);
    expect(memberships.every((m) => m.is_active === false)).toBe(true);
  });

  it("a pending request waiting on them at a Can-skip level → that level SKIPPED, the next level's approvers take over", async () => {
    const ctx = await setup();
    const { request } = await waitingOnLeaver(ctx, { canSkip: true, code: "SK" });
    await inNotice(ctx);
    await runLwdJob({ now: NEXT_DAY });

    await request.reload();
    expect(request).toMatchObject({ current_level: 2, final_status: "IN_PROGRESS" });
    const skipped = await db.ApprovalRequestLog.findAll({ where: { approval_request_id: request.id, level_no: 1, status: "SKIPPED" } });
    expect(skipped).toHaveLength(1);
    const inbox = (await api.get("/api/approvals/inbox", ctx.l2.token)).body.data.items;
    expect(inbox.map((i) => i.id)).toContain(request.id);
  });

  it("a level that can't be skipped blocks: the owner's inbox shows it blocked and the group flags the empty level", async () => {
    const ctx = await setup();
    const { group, request } = await waitingOnLeaver(ctx, { canSkip: false, code: "BL" });
    await inNotice(ctx);
    await runLwdJob({ now: NEXT_DAY });

    await request.reload();
    expect(request).toMatchObject({ current_level: 1, final_status: "PENDING" });
    const inbox = (await api.get("/api/approvals/inbox", ctx.token)).body.data.items;
    expect(inbox.find((i) => i.id === request.id)).toMatchObject({ blocked: true });
    const detail = (await api.get(`/api/approval-groups/${group.id}`, ctx.token)).body.data;
    expect(detail.levels_without_active_approver).toEqual([1]);
  });
});

describe("final approval of an exit whose LWD is already past", () => {
  it("→ processed in the same request (EXITED, account INACTIVE), not left for the job", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination({ noticeStartDate: "2026-10-11", noticeDays: 5 }));
    expect(exit.last_working_day).toBe("2026-10-15");
    await approve(ctx.l1.token, exit);
    expect((await exit.reload()).status).toBe("PENDING_APPROVAL");
    await approve(ctx.l2.token, exit);

    await exit.reload();
    expect(exit.status).toBe("EXITED");
    expect(exit.rehire_allowed_from).toBe("2026-11-15");
    expect(await eventsOf(exit)).toEqual(["RAISED", "APPROVED", "EXITED"]);
    expect(await db.Employee.findByPk(ctx.leaver.id)).toMatchObject({ employment_status: "EXITED", exit_date: "2026-10-15" });
    const account = await db.HrmsAccount.findOne({ where: { user_id: ctx.leaver.user.id, employer_id: ctx.employer.id } });
    expect(account.status).toBe("INACTIVE");
    const rows = await db.EmployeeProject.findAll({ where: { employee_id: ctx.leaver.id } });
    expect(rows.every((r) => !r.is_active && r.end_date === "2026-10-15")).toBe(true);
    expect((await ctx.department.reload()).dept_head_id).toBeNull();
  });

  it("an LWD of today stays IN_NOTICE at approval", async () => {
    const ctx = await setup();
    const exit = await inNotice(ctx);
    expect(await eventsOf(exit)).toEqual(["RAISED", "APPROVED"]);
  });
});

describe("idempotency and failures", () => {
  it("running the job twice changes nothing more", async () => {
    const ctx = await setup();
    const exit = await inNotice(ctx);
    await runLwdJob({ now: NEXT_DAY });
    const snapshot = async () => ({
      events: await eventsOf(exit),
      history: await db.EmployeeProjectHistory.count({ where: { employee_id: ctx.leaver.id } }),
      periods: await db.EmployeeMainProjectPeriod.count({ where: { employee_id: ctx.leaver.id } }),
      exit: (await exit.reload()).toJSON(),
    });
    const first = await snapshot();
    const second = await runLwdJob({ now: new Date("2026-10-23T05:00:00Z") });
    expect(second.processed).not.toContain(exit.id);
    expect(await snapshot()).toEqual(first);
  });

  it("a failure on one exit doesn't stop the others; it's retried on the next run", async () => {
    const ctx = await setup();
    const exit = await inNotice(ctx);
    const otherCtx = await setup();
    const fine = await inNotice(otherCtx);

    const create = db.ExitEvent.create.bind(db.ExitEvent);
    jest.spyOn(db.ExitEvent, "create").mockImplementation((values, options) => {
      if (values.exit_id === exit.id && values.event_type === "EXITED") return Promise.reject(new Error("boom"));
      return create(values, options);
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await runLwdJob({ now: NEXT_DAY });
    expect(result.failed).toContain(exit.id);
    expect(result.processed).toContain(fine.id);
    // The failed exit rolled back completely.
    expect((await exit.reload()).status).toBe("IN_NOTICE");
    expect((await db.Employee.findByPk(ctx.leaver.id)).employment_status).toBe("IN_NOTICE");
    expect((await db.HrmsAccount.findOne({ where: { user_id: ctx.leaver.user.id } })).status).toBe("ACTIVE");
    expect((await fine.reload()).status).toBe("EXITED");

    db.ExitEvent.create.mockRestore();
    const retry = await runLwdJob({ now: NEXT_DAY });
    expect(retry.processed).toContain(exit.id);
    expect((await exit.reload()).status).toBe("EXITED");
  });
});

describe("companies are processed independently, each on its own timezone", () => {
  it("at 05:00 UTC Riyadh has moved to the next day but Honolulu hasn't", async () => {
    const riyadh = await setup();
    const honolulu = await employeeSetup();
    await db.CompanyTimeSetting.update({ timezone: "Pacific/Honolulu" }, { where: { employer_id: honolulu.employer.id } });
    const leaver = await add(honolulu, { name: "Hana Leaver" });
    const theirs = await raise(honolulu.token, leaver, termination());
    await ownerApprove(honolulu, theirs);
    expect((await theirs.reload()).status).toBe("IN_NOTICE");
    const ours = await inNotice(riyadh);

    await runLwdJob({ now: NEXT_DAY }); // Riyadh 2026-10-22 08:00, Honolulu 2026-10-21 19:00
    expect((await ours.reload()).status).toBe("EXITED");
    expect((await theirs.reload()).status).toBe("IN_NOTICE");

    await runLwdJob({ now: new Date("2026-10-22T11:00:00Z") }); // Honolulu 2026-10-22 01:00
    expect((await theirs.reload()).status).toBe("EXITED");
  });
});

describe("scheduling", () => {
  const saved = { JOBS_ENABLED: process.env.JOBS_ENABLED, NODE_ENV: process.env.NODE_ENV };
  afterEach(() => Object.assign(process.env, saved));

  it("never runs in tests, even with JOBS_ENABLED=true", () => {
    const schedule = jest.spyOn(cron, "schedule");
    process.env.JOBS_ENABLED = "true";
    expect(startJobs()).toBeNull();
    expect(schedule).not.toHaveBeenCalled();
  });

  it("outside tests: an hourly tick only when JOBS_ENABLED=true", () => {
    const task = { stop: jest.fn() };
    const schedule = jest.spyOn(cron, "schedule").mockReturnValue(task);
    process.env.NODE_ENV = "development";
    process.env.JOBS_ENABLED = "false";
    expect(startJobs()).toBeNull();
    expect(schedule).not.toHaveBeenCalled();

    process.env.JOBS_ENABLED = "true";
    expect(startJobs()).toEqual([task]);
    expect(schedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function));
  });
});
