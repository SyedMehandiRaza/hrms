const bcrypt = require("bcrypt");
const { db, PASSWORD, MISSING_ID, errorBody, validationBody, loginAs, loginFor, createRole, api } = require("./helpers/api");
const { employeeSetup, createdEmployee } = require("./helpers/employees");
const mailer = require("../src/services/mailer");
const { clock } = require("../src/utils/clock");

// Exit approval outcomes, withdraw and emails (ticket workforce#16b; workforce D59, D68; standards
// §7.2 "Exit withdraw / cancel").

const TODAY = "2026-10-21";
// Emails are asserted from the in-memory outbox, whatever the local environment sets.
process.env.MAIL_DRIVER = "memory";

beforeEach(() => jest.spyOn(clock, "now").mockReturnValue(new Date(`${TODAY}T09:00:00Z`)));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const BOTH = { employee: { can_create: true, can_update: true } };
let phoneNo = 6000;
const add = (ctx, overrides = {}) =>
  createdEmployee(ctx, { phone: `05016${String((phoneNo += 1)).padStart(5, "0")}`, joiningDate: "2026-03-01", ...overrides });

const userOf = async (employeeId) => db.User.findByPk((await db.Employee.findByPk(employeeId)).user_id);
// A login for an employee created through the API, as if they had set their own password.
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
  noticeDays: 30,
  ...overrides,
});
const resignation = { exitType: "RESIGNATION", reasonCategory: "PERSONAL", reason: "Personal reasons at home." };
const raise = async (token, employee, body) => {
  const res = await api.post(`/api/employees/${employee.id || employee}/exits`, token, body);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return db.EmployeeExit.findByPk(res.body.data.id);
};
const approve = (token, exit, body = {}) => api.post(`/api/approvals/${exit.approval_request_id}/approve`, token, body);
const reject = (token, exit, reason) => api.post(`/api/approvals/${exit.approval_request_id}/reject`, token, { reason });
const withdraw = (token, exit, body) => api.post(`/api/exits/${exit.id || exit}/withdraw`, token, body);
const eventsOf = async (exit) =>
  (await db.ExitEvent.findAll({ where: { exit_id: exit.id }, order: [["created_at", "ASC"]], raw: true })).map((e) => e.event_type);
const mailsTo = (user) => mailer.outbox().filter((m) => m.to === user.email);

// Two-level group (L1: Lina, L2: Lars), a leaver routed to it, and an exit reader.
const setup = async () => {
  const ctx = await employeeSetup();
  const l1 = await person(ctx, { name: "Lina One" });
  const l2 = await person(ctx, { name: "Lars Two" });
  const group = await db.ApprovalGroup.create({ employer_id: ctx.employer.id, group_name: "Exits", group_code: "EX", module_key: "ALL", total_levels: 2 });
  await db.ApprovalGroupMember.create({ approval_group_id: group.id, employee_id: l1.id, level_no: 1, is_mandatory: true });
  await db.ApprovalGroupMember.create({ approval_group_id: group.id, employee_id: l2.id, level_no: 2, is_mandatory: true });
  const readerRole = await createRole(ctx.employer, { exit: { can_read: true } });
  const leaver = await person(ctx, { name: "Sara Leaver", approvalGroupId: group.id, roleId: readerRole.id });
  mailer.clear();
  return { ...ctx, l1, l2, group, leaver, readerRole };
};

describe("final approval", () => {
  it("→ exit and employee IN_NOTICE, exit event APPROVED; each level's approvers are emailed when reached", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    const needed = "An exit request for Sara Leaver needs your approval.";
    expect(mailsTo(ctx.l1.user).map((m) => [m.subject, m.text])).toEqual([["Exit request needs your approval", needed]]);
    expect(mailsTo(ctx.l2.user)).toEqual([]);

    expect((await approve(ctx.l1.token, exit)).status).toBe(200);
    expect(mailsTo(ctx.l2.user).map((m) => m.text)).toEqual([needed]);
    expect((await exit.reload()).status).toBe("PENDING_APPROVAL");

    expect((await approve(ctx.l2.token, exit)).status).toBe(200);
    expect((await exit.reload()).status).toBe("IN_NOTICE");
    expect((await db.Employee.findByPk(ctx.leaver.id)).employment_status).toBe("IN_NOTICE");
    expect(await eventsOf(exit)).toEqual(["RAISED", "APPROVED"]);
    const detail = (await api.get(`/api/exits/${exit.id}`, ctx.token)).body.data;
    expect(detail).toMatchObject({ status: "IN_NOTICE" });
    expect(detail.events.map((e) => e.event_type)).toEqual(["RAISED", "APPROVED"]);
  });

  it("an owner-only request approved by the owner → IN_NOTICE", async () => {
    const ctx = await employeeSetup();
    const leaver = await add(ctx, { name: "No Group" });
    mailer.clear();
    const exit = await raise(ctx.token, leaver, termination());
    expect(mailsTo(ctx.owner).map((m) => m.text)).toEqual(["An exit request for No Group needs your approval."]);
    expect((await approve(ctx.token, exit, { reason: "Approved after review" })).status).toBe(200);
    expect((await exit.reload()).status).toBe("IN_NOTICE");
    expect((await db.Employee.findByPk(leaver.id)).employment_status).toBe("IN_NOTICE");
  });

  it("the raiser is emailed on approval; a terminated employee is emailed only then", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    await approve(ctx.l1.token, exit);
    expect(mailsTo(ctx.leaver.user)).toEqual([]);
    expect(mailsTo(ctx.owner)).toEqual([]);
    await approve(ctx.l2.token, exit);
    expect(mailsTo(ctx.owner).map((m) => m.template)).toEqual(["exit-approved"]);
    expect(mailsTo(ctx.owner)[0]).toMatchObject({
      subject: "Exit request approved",
      text: "The exit request for Sara Leaver has been approved. Last working day: 2026-11-19.",
    });
    expect(mailsTo(ctx.leaver.user).map((m) => m.template)).toEqual(["exit-approved-employee"]);
    expect(mailsTo(ctx.leaver.user)[0]).toMatchObject({
      subject: "Your employment is ending",
      text: "Your exit has been approved. Your last working day is 2026-11-19.",
    });
  });

  it("an own resignation: the employee (the raiser) gets one approval email", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.leaver.token, "me", resignation);
    await approve(ctx.l1.token, exit);
    await approve(ctx.l2.token, exit);
    expect(mailsTo(ctx.leaver.user).map((m) => m.template)).toEqual(["exit-approved"]);
  });
});

describe("rejection", () => {
  it("→ exit REJECTED with the reason, event REJECTED, employee unchanged; a new exit can be raised", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    const res = await reject(ctx.l1.token, exit, "Not enough evidence yet");
    expect(res.status).toBe(200);
    await exit.reload();
    expect(exit).toMatchObject({ status: "REJECTED", reject_reason: "Not enough evidence yet" });
    expect(await eventsOf(exit)).toEqual(["RAISED", "REJECTED"]);
    const event = await db.ExitEvent.findOne({ where: { exit_id: exit.id, event_type: "REJECTED" } });
    expect(event.payload).toEqual({ reason: "Not enough evidence yet" });
    expect((await db.Employee.findByPk(ctx.leaver.id)).employment_status).toBe("ACTIVE");
    expect((await api.get(`/api/exits/${exit.id}`, ctx.token)).body.data).toMatchObject({ status: "REJECTED", reject_reason: "Not enough evidence yet" });
    await raise(ctx.token, ctx.leaver, termination());
  });

  it("the raiser is emailed with the reason; a terminated employee is not", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    await approve(ctx.l1.token, exit);
    await reject(ctx.l2.token, exit, "Not enough evidence yet");
    expect(mailsTo(ctx.owner).map((m) => m.template)).toEqual(["exit-rejected"]);
    expect(mailsTo(ctx.owner)[0]).toMatchObject({
      subject: "Exit request rejected",
      text: "The exit request for Sara Leaver has been rejected. Reason: Not enough evidence yet",
    });
    expect(mailsTo(ctx.leaver.user)).toEqual([]);
  });
});

// The Exit detail's approval progress by level (ticket workforce#34).
describe("exit detail approval progress", () => {
  const approvalOf = async (ctx, exit) => (await api.get(`/api/exits/${exit.id}`, ctx.token)).body.data.approval;

  it("shows each level's approvers and decisions as the request moves on", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    expect(await approvalOf(ctx, exit)).toEqual({
      status: "PENDING",
      current_level: 1,
      total_levels: 2,
      owner_only: false,
      levels: [
        { level: 1, status: "PENDING", approvers: [{ id: ctx.l1.id, name: "Lina One" }], decisions: [] },
        { level: 2, status: "WAITING", approvers: [{ id: ctx.l2.id, name: "Lars Two" }], decisions: [] },
      ],
      decisions: [],
    });

    await approve(ctx.l1.token, exit, { comment: "Fine by me" });
    await reject(ctx.l2.token, exit, "Not enough evidence yet");
    const progress = await approvalOf(ctx, exit);
    expect(progress).toMatchObject({ status: "REJECTED", current_level: 2, total_levels: 2, owner_only: false });
    expect(progress.levels).toEqual([
      {
        level: 1,
        status: "APPROVED",
        approvers: [{ id: ctx.l1.id, name: "Lina One" }],
        decisions: [{ name: "Lina One", status: "APPROVED", comment: "Fine by me", acted_at: expect.any(String), is_override: false }],
      },
      {
        level: 2,
        status: "REJECTED",
        approvers: [{ id: ctx.l2.id, name: "Lars Two" }],
        decisions: [{ name: "Lars Two", status: "REJECTED", comment: "Not enough evidence yet", acted_at: expect.any(String), is_override: false }],
      },
    ]);
  });

  it("an owner-only request has no levels; the owner's decision is listed as an override", async () => {
    const ctx = await employeeSetup();
    const leaver = await add(ctx, { name: "No Group" });
    const exit = await raise(ctx.token, leaver, termination());
    expect(await approvalOf(ctx, exit)).toEqual({ status: "PENDING", current_level: 1, total_levels: 1, owner_only: true, levels: [], decisions: [] });
    await approve(ctx.token, exit, { reason: "Approved after review" });
    const progress = await approvalOf(ctx, exit);
    expect(progress).toMatchObject({ status: "APPROVED", owner_only: true });
    expect(progress.decisions).toEqual([
      { name: ctx.owner.name, status: "APPROVED", comment: "Approved after review", acted_at: expect.any(String), is_override: true },
    ]);
  });
});

describe("the leaving employee's own views (D68)", () => {
  const listIds = async (token) => (await api.get("/api/exits", token)).body.data.items.map((i) => i.id);

  it("a termination raised by someone else is hidden from the employee until final approval", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    expect(await listIds(ctx.leaver.token)).toEqual([]);
    expect((await api.get(`/api/exits/${exit.id}`, ctx.leaver.token)).body).toEqual(errorBody("NOT_FOUND"));
    // Others with exit:read see it.
    const reader = await person(ctx, { roleId: ctx.readerRole.id, approvalGroupId: ctx.group.id });
    expect(await listIds(reader.token)).toEqual([exit.id]);

    await approve(ctx.l1.token, exit);
    expect(await listIds(ctx.leaver.token)).toEqual([]);
    await approve(ctx.l2.token, exit);
    expect(await listIds(ctx.leaver.token)).toEqual([exit.id]);
    expect((await api.get(`/api/exits/${exit.id}`, ctx.leaver.token)).status).toBe(200);
  });

  it("a rejected termination stays hidden from the employee", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    await reject(ctx.l1.token, exit, "Not enough evidence yet");
    expect(await listIds(ctx.leaver.token)).toEqual([]);
    expect((await api.get(`/api/exits/${exit.id}`, ctx.leaver.token)).body).toEqual(errorBody("NOT_FOUND"));
  });

  it("their own resignation is visible throughout", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.leaver.token, "me", resignation);
    expect(await listIds(ctx.leaver.token)).toEqual([exit.id]);
    expect((await api.get(`/api/exits/${exit.id}`, ctx.leaver.token)).status).toBe(200);
  });
});

describe("POST /api/exits/:id/withdraw", () => {
  const REASON = { reason: "Raised by mistake" };

  const expectWithdrawn = async (ctx, exit, res, actorId) => {
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: exit.id, status: "CANCELLED", cancel_reason: "Raised by mistake" });
    await exit.reload();
    expect(exit).toMatchObject({ status: "CANCELLED", cancel_reason: "Raised by mistake" });
    expect((await db.ApprovalRequest.findByPk(exit.approval_request_id)).final_status).toBe("CANCELLED");
    const event = await db.ExitEvent.findOne({ where: { exit_id: exit.id, event_type: "WITHDRAWN" } });
    expect(event).toMatchObject({ actor_user_id: actorId, payload: { reason: "Raised by mistake" } });
    expect((await db.Employee.findByPk(ctx.leaver.id)).employment_status).toBe("ACTIVE");
  };

  it("by the raiser (own resignation) → CANCELLED, request CANCELLED and gone from every inbox, event WITHDRAWN; past logs kept", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.leaver.token, "me", resignation);
    await approve(ctx.l1.token, exit);
    const inbox = async (token) => (await api.get("/api/approvals/inbox", token)).body.data.items.map((i) => i.id);
    expect(await inbox(ctx.l2.token)).toEqual([exit.approval_request_id]);

    await expectWithdrawn(ctx, exit, await withdraw(ctx.leaver.token, exit, REASON), ctx.leaver.user.id);
    expect(await inbox(ctx.l2.token)).toEqual([]);
    expect(await inbox(ctx.token)).toEqual([]);
    const logs = await db.ApprovalRequestLog.findAll({ where: { approval_request_id: exit.approval_request_id, level_no: 1 } });
    expect(logs.map((l) => l.status)).toEqual(["APPROVED"]);
    // The request can no longer be decided; a new exit can be raised.
    expect((await approve(ctx.l2.token, exit)).body).toEqual(errorBody("APPROVAL_ALREADY_DECIDED"));
    await raise(ctx.leaver.token, "me", resignation);
  });

  it("by the owner, or by a user with employee:create + update → CANCELLED", async () => {
    const ctx = await setup();
    const first = await raise(ctx.leaver.token, "me", resignation);
    await expectWithdrawn(ctx, first, await withdraw(ctx.token, first, REASON), ctx.owner.id);
    const second = await raise(ctx.token, ctx.leaver, termination());
    const hr = await loginFor(ctx.employer, "SUB_ADMIN", BOTH);
    await expectWithdrawn(ctx, second, await withdraw(hr.token, second, REASON), hr.person.id);
  });

  it("by anyone else → 403 FORBIDDEN (another employee, one permission only, the terminated employee)", async () => {
    const ctx = await setup();
    const mine = await raise(ctx.leaver.token, "me", resignation);
    const other = await person(ctx, { approvalGroupId: ctx.group.id });
    expect((await withdraw(other.token, mine, REASON)).body).toEqual(errorBody("FORBIDDEN"));
    for (const modules of [{ employee: { can_create: true } }, { employee: { can_update: true } }]) {
      const { token } = await loginFor(ctx.employer, "SUB_ADMIN", modules);
      expect((await withdraw(token, mine, REASON)).body).toEqual(errorBody("FORBIDDEN"));
    }
    await withdraw(ctx.token, mine, REASON);
    const theirs = await raise(ctx.token, ctx.leaver, termination());
    expect((await withdraw(ctx.leaver.token, theirs, REASON)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await theirs.reload()).status).toBe("PENDING_APPROVAL");
  });

  it.each([
    ["no reason", {}],
    ["a short reason", { reason: "Oops" }],
    ["a blank reason", { reason: "     " }],
    ["a reason over 500", { reason: "x".repeat(501) }],
  ])("%s → reason 'Reason must be 5–500 characters'", async (_label, body) => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    const res = await withdraw(ctx.token, exit, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ reason: "reason5to500" }));
    expect(res.body.errors.reason).toBe("Reason must be 5–500 characters");
    expect((await exit.reload()).status).toBe("PENDING_APPROVAL");
  });

  it("an exit that isn't PENDING_APPROVAL → 409 EXIT_INVALID_STATE", async () => {
    const ctx = await setup();
    const rejected = await raise(ctx.token, ctx.leaver, termination());
    await reject(ctx.l1.token, rejected, "Not enough evidence yet");
    const withdrawn = await raise(ctx.token, ctx.leaver, termination());
    await withdraw(ctx.token, withdrawn, REASON);
    const approved = await raise(ctx.token, ctx.leaver, termination());
    await approve(ctx.l1.token, approved);
    await approve(ctx.l2.token, approved);
    for (const exit of [rejected, withdrawn, approved]) {
      const res = await withdraw(ctx.token, exit, REASON);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("EXIT_INVALID_STATE"));
      expect(res.body.message).toBe("This action isn't possible in the exit's current status.");
    }
    expect((await approved.reload()).status).toBe("IN_NOTICE");
  });

  it("another company's or an unknown exit → 404; a STAFFING_COMPANY login → 403; no token → 401", async () => {
    const ctx = await setup();
    const exit = await raise(ctx.token, ctx.leaver, termination());
    const other = await employeeSetup();
    for (const id of [exit.id, MISSING_ID, "nope"]) {
      expect((await withdraw(other.token, id, REASON)).body).toEqual(errorBody("NOT_FOUND"));
    }
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", BOTH)).token;
    expect((await withdraw(staffing, exit, REASON)).body).toEqual(errorBody("FORBIDDEN"));
    expect((await withdraw(null, exit, REASON)).status).toBe(401);
    expect((await exit.reload()).status).toBe("PENDING_APPROVAL");
  });
});
