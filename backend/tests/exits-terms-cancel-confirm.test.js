const bcrypt = require("bcrypt");
const { db, PASSWORD, MISSING_ID, errorBody, validationBody, loginAs, loginFor, api } = require("./helpers/api");
const { employeeSetup, createdEmployee } = require("./helpers/employees");
const { clock } = require("../src/utils/clock");

// Exit edit terms, cancel and Confirm → Immediate (ticket workforce#17; workforce D62, D63, D64,
// D65; standards §7.2 "Exit (raise, edit terms)", "Exit withdraw / cancel", "Exit confirm immediate").

const TODAY = "2026-10-21";
process.env.MAIL_DRIVER = "memory";

beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const BOTH = { employee: { can_create: true, can_update: true } };
let phoneNo = 8000;
const add = (ctx, overrides = {}) =>
  createdEmployee(ctx, { phone: `05018${String((phoneNo += 1)).padStart(5, "0")}`, joiningDate: "2026-03-01", ...overrides });

const loginOf = async (employeeId) => {
  const user = await db.User.findByPk((await db.Employee.findByPk(employeeId)).user_id);
  await db.User.update({ password: await bcrypt.hash(PASSWORD, 4) }, { where: { id: user.id } });
  await db.HrmsAccount.update({ password_setup_required: false, password_setup_token_hash: null }, { where: { user_id: user.id } });
  return { user, token: await loginAs(user.email) };
};

const termination = (overrides = {}) => ({
  exitType: "TERMINATION",
  reasonCategory: "PERFORMANCE",
  reason: "Repeated missed targets over two quarters.",
  noticeStartDate: TODAY,
  noticeDays: 30,
  ...overrides,
});
const raise = async (token, employee, body) => {
  const res = await api.post(`/api/employees/${employee.id || employee}/exits`, token, body);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return db.EmployeeExit.findByPk(res.body.data.id);
};
const ownerApprove = async (ctx, exit) => {
  const res = await api.post(`/api/approvals/${exit.approval_request_id}/approve`, ctx.token, { reason: "Approved after review" });
  if (res.status !== 200) throw new Error(JSON.stringify(res.body));
};

// A leaver (no approval group: the owner approves) with an IN_NOTICE exit, LWD 2026-11-19.
const setup = async (overrides) => {
  const ctx = await employeeSetup();
  const leaver = await add(ctx, { name: "Sara Leaver" });
  const exit = await raise(ctx.token, leaver, termination(overrides));
  await ownerApprove(ctx, exit);
  expect((await exit.reload()).status).toBe("IN_NOTICE");
  return { ...ctx, leaver, exit };
};

const editTerms = (token, exit, body) => api.put(`/api/exits/${exit.id || exit}/terms`, token, body);
const cancel = (token, exit, body) => api.post(`/api/exits/${exit.id || exit}/cancel`, token, body);
const confirmImmediate = (token, exit, body) => api.post(`/api/exits/${exit.id || exit}/confirm-immediate`, token, body);
const eventsOf = async (exit) =>
  db.ExitEvent.findAll({ where: { exit_id: exit.id }, order: [["created_at", "ASC"], ["id", "ASC"]], raw: true });
// Events written in one transaction can share a millisecond, so those are compared as a set.
const typesOf = async (exit) => (await eventsOf(exit)).map((e) => e.event_type);
const sameEvents = (types, expected) => expect([...types].sort()).toEqual([...expected].sort());
const statusOf = async (employee) => (await db.Employee.findByPk(employee.id)).employment_status;

describe("PUT /api/exits/:id/terms", () => {
  it("changes the LWD without re-approval; original LWD kept; LWD_EXTENDED records old and new", async () => {
    const ctx = await setup();
    const res = await editTerms(ctx.token, ctx.exit, { lastWorkingDay: "2026-12-15" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "IN_NOTICE", last_working_day: "2026-12-15", original_last_working_day: "2026-11-19" });
    await ctx.exit.reload();
    expect(ctx.exit).toMatchObject({ status: "IN_NOTICE", last_working_day: "2026-12-15", original_last_working_day: "2026-11-19" });
    expect((await db.ApprovalRequest.findByPk(ctx.exit.approval_request_id)).final_status).toBe("APPROVED");
    const event = (await eventsOf(ctx.exit)).find((e) => e.event_type === "LWD_EXTENDED");
    expect(event).toMatchObject({ actor_user_id: ctx.owner.id, payload: { old: { last_working_day: "2026-11-19" }, new: { last_working_day: "2026-12-15" } } });
    expect(await statusOf(ctx.leaver)).toBe("IN_NOTICE");
  });

  it("notice days, reason and settlement choices → saved; TERMS_UPDATED records old and new values", async () => {
    const ctx = await setup({ encashLeave: true, loanHandling: "NONE" });
    const res = await editTerms(ctx.token, ctx.exit, {
      reasonCategory: "MISCONDUCT",
      reason: "Breach of the code of conduct, documented.",
      encashLeave: false,
      loanHandling: "RECOVER",
      rehireEligible: true,
      coolingPeriodDays: 60,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      reason_category: "MISCONDUCT",
      reason: "Breach of the code of conduct, documented.",
      encash_leave: false,
      loan_handling: "RECOVER",
      rehire_eligible: true,
      cooling_period_days: 60,
      last_working_day: "2026-11-19",
    });
    const events = await eventsOf(ctx.exit);
    expect(events.map((e) => e.event_type)).toEqual(["RAISED", "APPROVED", "TERMS_UPDATED"]);
    expect(events[2].payload).toEqual({
      old: { reason_category: "PERFORMANCE", reason: "Repeated missed targets over two quarters.", encash_leave: true, loan_handling: "NONE", rehire_eligible: false, cooling_period_days: 180 },
      new: { reason_category: "MISCONDUCT", reason: "Breach of the code of conduct, documented.", encash_leave: false, loan_handling: "RECOVER", rehire_eligible: true, cooling_period_days: 60 },
    });
  });

  it("new notice days without an LWD → LWD = start + days − 1 (both events)", async () => {
    const ctx = await setup();
    const res = await editTerms(ctx.token, ctx.exit, { noticeDays: 45 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ notice_days: 45, last_working_day: "2026-12-04", original_last_working_day: "2026-11-19" });
    sameEvents(await typesOf(ctx.exit), ["RAISED", "APPROVED", "TERMS_UPDATED", "LWD_EXTENDED"]);
  });

  it("nothing changed → no event", async () => {
    const ctx = await setup();
    expect((await editTerms(ctx.token, ctx.exit, { lastWorkingDay: "2026-11-19", noticeDays: 30 })).status).toBe(200);
    expect((await eventsOf(ctx.exit)).map((e) => e.event_type)).toEqual(["RAISED", "APPROVED"]);
  });

  it("the LWD history lists every change in order", async () => {
    const ctx = await setup();
    for (const lwd of ["2026-12-01", "2026-11-25", "2027-01-10"]) {
      expect((await editTerms(ctx.token, ctx.exit, { lastWorkingDay: lwd })).status).toBe(200);
    }
    const detail = (await api.get(`/api/exits/${ctx.exit.id}`, ctx.token)).body.data;
    expect(detail.lwd_history.map((h) => [h.from, h.to])).toEqual([
      ["2026-11-19", "2026-12-01"],
      ["2026-12-01", "2026-11-25"],
      ["2026-11-25", "2027-01-10"],
    ]);
    expect(detail.lwd_history[0]).toMatchObject({ actor_user_id: ctx.owner.id, created_at: expect.any(String) });
  });

  it("an LWD before the notice start or more than 365 days after it → the §7.2 texts", async () => {
    const ctx = await setup();
    let res = await editTerms(ctx.token, ctx.exit, { lastWorkingDay: "2026-10-20" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ lastWorkingDay: "lwdBeforeStart" }));
    expect(res.body.errors.lastWorkingDay).toBe("Last working day must be on/after the notice start date");
    res = await editTerms(ctx.token, ctx.exit, { lastWorkingDay: "2027-10-22" });
    expect(res.body).toEqual(validationBody({ lastWorkingDay: "lwdTooFar" }));
    expect(res.body.errors.lastWorkingDay).toBe("Last working day must be within 365 days of the notice start date");
    res = await editTerms(ctx.token, ctx.exit, { lastWorkingDay: "2026-02-30" });
    expect(res.body).toEqual(validationBody({ lastWorkingDay: "lwdInvalid" }));
    res = await editTerms(ctx.token, ctx.exit, { noticeDays: 181, reason: "short" });
    expect(res.body).toEqual(validationBody({ noticeDays: "noticeDays", reason: "exitReason" }));
    expect((await ctx.exit.reload()).last_working_day).toBe("2026-11-19");
  });

  it("a non-owner moving the LWD into the past → 'Last working day cannot be in the past'", async () => {
    const ctx = await setup({ noticeStartDate: "2026-10-01" });
    const hr = await loginFor(ctx.employer, "SUB_ADMIN", BOTH);
    const res = await editTerms(hr.token, ctx.exit, { lastWorkingDay: "2026-10-15" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ lastWorkingDay: "lwdPast" }));
    expect(res.body.errors.lastWorkingDay).toBe("Last working day cannot be in the past");
    expect((await ctx.exit.reload()).status).toBe("IN_NOTICE");
    // A future LWD is fine for them.
    expect((await editTerms(hr.token, ctx.exit, { lastWorkingDay: "2026-11-30" })).status).toBe(200);
  });

  it("the owner moving the LWD into the past → the exit is processed at once (exit date = new LWD)", async () => {
    const ctx = await setup({ noticeStartDate: "2026-10-01" });
    const res = await editTerms(ctx.token, ctx.exit, { lastWorkingDay: "2026-10-15" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "EXITED", last_working_day: "2026-10-15", rehire_allowed_from: "2027-04-14" });
    const employee = await db.Employee.findByPk(ctx.leaver.id);
    expect(employee).toMatchObject({ employment_status: "EXITED", exit_date: "2026-10-15" });
    expect((await db.HrmsAccount.findOne({ where: { user_id: employee.user_id } })).status).toBe("INACTIVE");
    sameEvents(await typesOf(ctx.exit), ["RAISED", "APPROVED", "LWD_EXTENDED", "EXITED"]);
  });

  it("needs employee:create and employee:update; STAFFING_COMPANY → 403; no token → 401", async () => {
    const ctx = await setup();
    for (const modules of [{ employee: { can_create: true } }, { employee: { can_update: true } }, { exit: { can_read: true, can_update: true } }]) {
      const { token } = await loginFor(ctx.employer, "SUB_ADMIN", modules);
      expect((await editTerms(token, ctx.exit, { lastWorkingDay: "2026-12-01" })).body).toEqual(errorBody("FORBIDDEN"));
    }
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", BOTH)).token;
    expect((await editTerms(staffing, ctx.exit, { lastWorkingDay: "2026-12-01" })).body).toEqual(errorBody("FORBIDDEN"));
    expect((await editTerms(null, ctx.exit, { lastWorkingDay: "2026-12-01" })).status).toBe(401);
    const hr = await loginFor(ctx.employer, "SUB_ADMIN", BOTH);
    expect((await editTerms(hr.token, ctx.exit, { lastWorkingDay: "2026-12-01" })).status).toBe(200);
  });
});

describe("POST /api/exits/:id/cancel", () => {
  const REASON = { reason: "Performance has improved" };

  it("with a reason → exit CANCELLED, employee back to ACTIVE, event CANCELLED", async () => {
    const ctx = await setup();
    const hr = await loginFor(ctx.employer, "SUB_ADMIN", BOTH);
    const res = await cancel(hr.token, ctx.exit, REASON);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: ctx.exit.id, status: "CANCELLED", cancel_reason: "Performance has improved" });
    await ctx.exit.reload();
    expect(ctx.exit).toMatchObject({ status: "CANCELLED", cancel_reason: "Performance has improved", cancelled_by: hr.person.id });
    expect(ctx.exit.cancelled_at).toBeTruthy();
    expect(await statusOf(ctx.leaver)).toBe("ACTIVE");
    const event = (await eventsOf(ctx.exit)).find((e) => e.event_type === "CANCELLED");
    expect(event).toMatchObject({ actor_user_id: hr.person.id, payload: { reason: "Performance has improved" } });
    // A new exit can be raised.
    await raise(ctx.token, ctx.leaver, termination());
  });

  it.each([
    ["no reason", {}],
    ["a short reason", { reason: "Oops" }],
    ["a reason over 500", { reason: "x".repeat(501) }],
  ])("%s → reason 'Reason must be 5–500 characters'", async (_label, body) => {
    const ctx = await setup();
    const res = await cancel(ctx.token, ctx.exit, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ reason: "reason5to500" }));
    expect(res.body.errors.reason).toBe("Reason must be 5–500 characters");
    expect((await ctx.exit.reload()).status).toBe("IN_NOTICE");
  });

  it("needs employee:create and employee:update; the leaving employee can't", async () => {
    const ctx = await setup();
    for (const modules of [{ employee: { can_create: true } }, { employee: { can_update: true } }]) {
      const { token } = await loginFor(ctx.employer, "SUB_ADMIN", modules);
      expect((await cancel(token, ctx.exit, REASON)).body).toEqual(errorBody("FORBIDDEN"));
    }
    const leaver = await loginOf(ctx.leaver.id);
    expect((await cancel(leaver.token, ctx.exit, REASON)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await cancel(null, ctx.exit, REASON)).status).toBe(401);
    expect((await ctx.exit.reload()).status).toBe("IN_NOTICE");
  });
});

describe("POST /api/exits/:id/confirm-immediate", () => {
  const REASON = { reason: "Gross misconduct on site" };

  it("owner with a reason → LWD = today, processed at once (exit date = today); original LWD kept", async () => {
    const ctx = await setup();
    const res = await confirmImmediate(ctx.token, ctx.exit, REASON);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "EXITED", last_working_day: TODAY, original_last_working_day: "2026-11-19" });
    await ctx.exit.reload();
    expect(ctx.exit).toMatchObject({ status: "EXITED", confirm_mode: "IMMEDIATE", confirm_override_reason: "Gross misconduct on site", confirmed_by: ctx.owner.id });
    expect(ctx.exit.confirmed_at).toBeTruthy();
    const employee = await db.Employee.findByPk(ctx.leaver.id);
    expect(employee).toMatchObject({ employment_status: "EXITED", exit_date: TODAY });
    expect((await db.HrmsAccount.findOne({ where: { user_id: employee.user_id } })).status).toBe("INACTIVE");
    const events = await eventsOf(ctx.exit);
    sameEvents(events.map((e) => e.event_type), ["RAISED", "APPROVED", "LWD_EXTENDED", "CONFIRMED_WITH_OVERRIDE", "EXITED"]);
    const byType = (type) => events.find((e) => e.event_type === type);
    expect(byType("LWD_EXTENDED").payload).toEqual({ old: { last_working_day: "2026-11-19" }, new: { last_working_day: TODAY } });
    expect(byType("CONFIRMED_WITH_OVERRIDE")).toMatchObject({ actor_user_id: ctx.owner.id, payload: { mode: "IMMEDIATE", reason: "Gross misconduct on site" } });
  });

  it.each([
    ["no reason", {}],
    ["a short reason", { reason: "Too short" }],
    ["a reason over 500", { reason: "x".repeat(501) }],
  ])("%s → reason 'Override reason must be 10–500 characters'", async (_label, body) => {
    const ctx = await setup();
    const res = await confirmImmediate(ctx.token, ctx.exit, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ reason: "overrideReason" }));
    expect(res.body.errors.reason).toBe("Override reason must be 10–500 characters");
    expect((await ctx.exit.reload()).status).toBe("IN_NOTICE");
  });

  it("a non-owner (even with employee:create + update) → 403 FORBIDDEN", async () => {
    const ctx = await setup();
    const hr = await loginFor(ctx.employer, "SUB_ADMIN", BOTH);
    expect((await confirmImmediate(hr.token, ctx.exit, REASON)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await confirmImmediate(null, ctx.exit, REASON)).status).toBe(401);
    expect((await ctx.exit.reload()).status).toBe("IN_NOTICE");
  });
});

describe("state and tenancy", () => {
  it("edit, cancel or confirm a PENDING_APPROVAL, REJECTED, CANCELLED or EXITED exit → 409 EXIT_INVALID_STATE", async () => {
    const ctx = await employeeSetup();
    const leaver = await add(ctx, { name: "State Leaver" });
    const withdrawn = await raise(ctx.token, leaver, termination());
    await api.post(`/api/exits/${withdrawn.id}/withdraw`, ctx.token, { reason: "Raised by mistake" });
    const rejected = await raise(ctx.token, leaver, termination());
    await api.post(`/api/approvals/${rejected.approval_request_id}/reject`, ctx.token, { reason: "Not enough evidence" });
    const exited = await raise(ctx.token, leaver, termination());
    await ownerApprove(ctx, exited);
    await confirmImmediate(ctx.token, exited, { reason: "Gross misconduct on site" });
    const pending = await raise(ctx.token, await add(ctx, { name: "Pending Leaver" }), termination());

    for (const [exit, status] of [
      [pending, "PENDING_APPROVAL"],
      [withdrawn, "CANCELLED"],
      [rejected, "REJECTED"],
      [exited, "EXITED"],
    ]) {
      expect((await exit.reload()).status).toBe(status);
      for (const res of [
        await editTerms(ctx.token, exit, { lastWorkingDay: "2026-12-01" }),
        await cancel(ctx.token, exit, { reason: "Changed our mind" }),
        await confirmImmediate(ctx.token, exit, { reason: "Gross misconduct on site" }),
      ]) {
        expect(res.status).toBe(409);
        expect(res.body).toEqual(errorBody("EXIT_INVALID_STATE"));
        expect(res.body.message).toBe("This action isn't possible in the exit's current status.");
      }
      expect((await exit.reload()).status).toBe(status);
    }
  });

  it("another company's or an unknown exit → 404 NOT_FOUND", async () => {
    const ctx = await setup();
    const other = await employeeSetup();
    for (const id of [ctx.exit.id, MISSING_ID, "nope"]) {
      expect((await editTerms(other.token, id, { lastWorkingDay: "2026-12-01" })).body).toEqual(errorBody("NOT_FOUND"));
      expect((await cancel(other.token, id, { reason: "Changed our mind" })).body).toEqual(errorBody("NOT_FOUND"));
      expect((await confirmImmediate(other.token, id, { reason: "Gross misconduct on site" })).body).toEqual(errorBody("NOT_FOUND"));
    }
    expect((await ctx.exit.reload()).status).toBe("IN_NOTICE");
  });
});
