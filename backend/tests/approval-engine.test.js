const crypto = require("crypto");
const { db, errorBody, validationBody, ownerCompany, createEmployee, loginAs, api } = require("./helpers/api");
const approvals = require("../src/services/approval.service");
const mailer = require("../src/services/mailer");
const templates = require("../src/services/mailer/templates");

// Approval engine core (ticket workforce#11a; workforce D18, D23–D25, D28, D29).

// A test entity with its own label and email text (the exit, with its real text, arrives in 16b).
const onApproved = jest.fn();
const onRejected = jest.fn();
templates["test-approval-needed"] = {
  required: ["employeeName"],
  en: ({ employeeName }) => ({ subject: "Approval needed", text: `A test request for ${employeeName} needs your approval.` }),
  ar: ({ employeeName }) => ({ subject: "موافقة مطلوبة", text: `طلب اختبار للموظف ${employeeName} بانتظار موافقتك.` }),
};
approvals.registerEntity("TEST_ENTITY", {
  moduleKey: "TEST",
  label: { en: "Test", ar: "اختبار" },
  codePrefix: "TST",
  approvalTemplate: "test-approval-needed",
  onApproved: (...args) => onApproved(...args),
  onRejected: (...args) => onRejected(...args),
});

beforeEach(() => {
  onApproved.mockReset();
  onRejected.mockReset();
  mailer.clear();
});
afterAll(async () => {
  delete templates["test-approval-needed"];
  await db.sequelize.close();
});

// An employee with a login (EMPLOYEE), so they can open their inbox.
const approver = async (employer, name) => {
  const employee = await createEmployee(employer, { full_name: name });
  await db.HrmsAccount.create({ user_id: employee.user_id, employer_id: employer.id, access_level: "EMPLOYEE", password_setup_required: false });
  const user = await db.User.findByPk(employee.user_id);
  return { employee, user, token: await loginAs(user.email) };
};

const makeGroup = async (employer, levels) => {
  const group = await db.ApprovalGroup.create({
    employer_id: employer.id,
    group_name: `Group ${crypto.randomUUID().slice(0, 8)}`,
    group_code: `G-${crypto.randomUUID().slice(0, 8)}`,
    module_key: "ALL",
    total_levels: levels.length,
  });
  for (const [i, members] of levels.entries()) {
    for (const m of members) {
      await db.ApprovalGroupMember.create({
        approval_group_id: group.id,
        employee_id: m.employee.id,
        level_no: i + 1,
        is_mandatory: m.mandatory ?? true,
        can_skip: false,
      });
    }
  }
  return group;
};

const routeTo = (employer, employee, group) =>
  db.EmployeeApprovalRouting.create({ employer_id: employer.id, employee_id: employee.id, module_key: "ALL", approval_group_id: group.id });

const raise = (ctx, subject) =>
  db.sequelize.transaction((transaction) =>
    approvals.raise({
      employerId: ctx.employer.id,
      entityType: "TEST_ENTITY",
      entityId: crypto.randomUUID(),
      subjectEmployeeId: subject.id,
      raisedBy: { userId: ctx.owner.id, employeeId: null },
      transaction,
    })
  );

// Owner, two levels (L1: one mandatory approver, L2: one), and an employee routed to the group.
const setup = async () => {
  const ctx = await ownerCompany();
  const l1 = await approver(ctx.employer, "Lina One");
  const l2 = await approver(ctx.employer, "Lars Two");
  const group = await makeGroup(ctx.employer, [[l1], [l2]]);
  const subject = await createEmployee(ctx.employer, { full_name: "Sara Subject" });
  await routeTo(ctx.employer, subject, group);
  return { ...ctx, l1, l2, group, subject };
};
const mailsTo = (user) => mailer.outbox().filter((m) => m.to === user.email);
const approve = (who, request) => api.post(`/api/approvals/${request.id}/approve`, who.token, {});
const rejectApi = (who, request, reason) => api.post(`/api/approvals/${request.id}/reject`, who.token, { reason });

describe("raising a request", () => {
  it("records the group, levels, level 1 and PENDING, the raiser as a user, a pending log per L1 approver, and emails L1", async () => {
    const ctx = await setup();
    const request = await raise(ctx, ctx.subject);
    await request.reload();
    expect(request).toMatchObject({
      approval_group_id: ctx.group.id,
      total_levels: 2,
      current_level: 1,
      final_status: "PENDING",
      requested_by: null,
      requested_by_user_id: ctx.owner.id,
      subject_employee_id: ctx.subject.id,
      module_key: "TEST",
    });
    const logs = await db.ApprovalRequestLog.findAll({ where: { approval_request_id: request.id }, raw: true });
    expect(logs).toEqual([expect.objectContaining({ employee_id: ctx.l1.employee.id, level_no: 1, status: "PENDING" })]);
    expect(mailsTo(ctx.l1.user).map((m) => m.text)).toEqual(["A test request for Sara Subject needs your approval."]);
    expect(mailsTo(ctx.l2.user)).toEqual([]);
  });

  it("an employee with no group gets an owner-only request: no member logs, only the owner's inbox, the owner is emailed", async () => {
    const ctx = await setup();
    const loner = await createEmployee(ctx.employer, { full_name: "No Group" });
    const request = await raise(ctx, loner);
    await request.reload();
    expect(request.approval_group_id).toBeNull();
    expect(await db.ApprovalRequestLog.count({ where: { approval_request_id: request.id } })).toBe(0);
    expect(mailsTo(ctx.owner).map((m) => m.text)).toEqual(["A test request for No Group needs your approval."]);
    const ownerInbox = (await api.get("/api/approvals/inbox", ctx.token)).body.data.items;
    expect(ownerInbox).toEqual([expect.objectContaining({ id: request.id, owner_only: true, type: "Test" })]);
    expect((await api.get("/api/approvals/inbox", ctx.l1.token)).body.data.items).toEqual([]);
  });

  it("an inactive group counts as no group (owner-only)", async () => {
    const ctx = await setup();
    await ctx.group.update({ is_active: false });
    const request = await raise(ctx, ctx.subject);
    expect((await request.reload()).approval_group_id).toBeNull();
  });
});

describe("deciding", () => {
  it("L1's only mandatory approver approves → level 2, whose approvers are emailed", async () => {
    const ctx = await setup();
    const request = await raise(ctx, ctx.subject);
    const res = await approve(ctx.l1, request);
    expect(res.status).toBe(200);
    await request.reload();
    expect([request.current_level, request.final_status]).toEqual([2, "IN_PROGRESS"]);
    expect(mailsTo(ctx.l2.user).map((m) => m.text)).toEqual(["A test request for Sara Subject needs your approval."]);
    const l1log = await db.ApprovalRequestLog.findOne({ where: { approval_request_id: request.id, level_no: 1 } });
    expect(l1log).toMatchObject({ status: "APPROVED", actor_user_id: ctx.l1.user.id });
    expect(l1log.acted_at).not.toBeNull();
  });

  it("a level with two mandatory approvers moves on only after both approve", async () => {
    const ctx = await ownerCompany();
    const [a, b, c] = [await approver(ctx.employer, "A A"), await approver(ctx.employer, "B B"), await approver(ctx.employer, "C C")];
    const group = await makeGroup(ctx.employer, [[a, b], [c]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    const request = await raise(ctx, subject);
    await approve(a, request);
    expect((await request.reload()).current_level).toBe(1);
    await approve(b, request);
    expect((await request.reload()).current_level).toBe(2);
  });

  it("a level with no mandatory approvers moves on after any one approves", async () => {
    const ctx = await ownerCompany();
    const [a, b, c] = [await approver(ctx.employer, "A A"), await approver(ctx.employer, "B B"), await approver(ctx.employer, "C C")];
    const group = await makeGroup(ctx.employer, [[{ ...a, mandatory: false }, { ...b, mandatory: false }], [c]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    const request = await raise(ctx, subject);
    await approve(b, request);
    expect((await request.reload()).current_level).toBe(2);
  });

  it("the last level approves → APPROVED, completed, and the entity's on-approved hook runs once", async () => {
    const ctx = await setup();
    const request = await raise(ctx, ctx.subject);
    await approve(ctx.l1, request);
    await approve(ctx.l2, request);
    await request.reload();
    expect(request.final_status).toBe("APPROVED");
    expect(request.completed_at).not.toBeNull();
    expect(onApproved).toHaveBeenCalledTimes(1);
    expect(onApproved.mock.calls[0][0].id).toBe(request.id);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it("any approver rejecting with a reason → REJECTED and the on-rejected hook runs", async () => {
    const ctx = await setup();
    const request = await raise(ctx, ctx.subject);
    const res = await rejectApi(ctx.l1, request, "Not enough notice given");
    expect(res.status).toBe(200);
    await request.reload();
    expect(request).toMatchObject({ final_status: "REJECTED", remarks: "Not enough notice given" });
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(onRejected.mock.calls[0][1]).toMatchObject({ reason: "Not enough notice given" });
    expect(await db.ApprovalRequestLog.findOne({ where: { approval_request_id: request.id, level_no: 1 } })).toMatchObject({
      status: "REJECTED",
      comments: "Not enough notice given",
    });
  });

  it.each([undefined, "", "four", "R".repeat(501)])("a rejection reason %j → 400 reason 'Reason must be 5–500 characters'", async (reason) => {
    const ctx = await setup();
    const request = await raise(ctx, ctx.subject);
    const res = await rejectApi(ctx.l1, request, reason);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ reason: "reason5to500" }));
    expect((await request.reload()).final_status).toBe("PENDING");
  });
});

describe("GET /api/approvals/inbox", () => {
  it("lists only requests at the caller's current level, with type, employee, dates and level", async () => {
    const ctx = await setup();
    const request = await raise(ctx, ctx.subject);
    const l1 = (await api.get("/api/approvals/inbox", ctx.l1.token)).body.data;
    expect(l1).toEqual({
      items: [
        {
          id: request.id,
          request_code: request.request_code,
          entity_type: "TEST_ENTITY",
          entity_id: request.entity_id,
          type: "Test",
          employee: { id: ctx.subject.id, name: "Sara Subject", employee_code: ctx.subject.employee_code },
          requested_at: expect.any(String),
          current_level: 1,
          total_levels: 2,
          owner_only: false,
        },
      ],
      total: 1,
    });
    expect((await api.get("/api/approvals/inbox", ctx.l2.token)).body.data.items).toEqual([]);
    await approve(ctx.l1, request);
    expect((await api.get("/api/approvals/inbox", ctx.l1.token)).body.data.items).toEqual([]);
    expect((await api.get("/api/approvals/inbox", ctx.l2.token)).body.data.items.map((i) => i.id)).toEqual([request.id]);
  });

  it("answers the type in Arabic when asked", async () => {
    const ctx = await setup();
    await raise(ctx, ctx.subject);
    expect((await api.get("/api/approvals/inbox", ctx.l1.token, { lang: "ar" })).body.data.items[0].type).toBe("اختبار");
  });
});

describe("live members (D28)", () => {
  it("a changed group changes who can act on current and future levels; past log rows don't change", async () => {
    const ctx = await setup();
    const request = await raise(ctx, ctx.subject);
    await approve(ctx.l1, request);
    const pastLog = (await db.ApprovalRequestLog.findOne({ where: { approval_request_id: request.id, level_no: 1 }, raw: true }));
    // L2 now belongs to someone else.
    const replacement = await approver(ctx.employer, "Rita Replacement");
    await db.ApprovalGroupMember.update({ is_active: false }, { where: { approval_group_id: ctx.group.id, level_no: 2 } });
    await db.ApprovalGroupMember.create({ approval_group_id: ctx.group.id, employee_id: replacement.employee.id, level_no: 2, is_mandatory: true });
    expect((await approve(ctx.l2, request)).body).toEqual(errorBody("APPROVAL_NOT_YOUR_TURN"));
    expect((await approve(replacement, request)).status).toBe(200);
    expect((await request.reload()).final_status).toBe("APPROVED");
    expect(await db.ApprovalRequestLog.findOne({ where: { id: pastLog.id }, raw: true })).toEqual(pastLog);
  });
});

describe("cancel", () => {
  it("cancelling a pending request → CANCELLED; it leaves every inbox; past logs stay", async () => {
    const ctx = await setup();
    const request = await raise(ctx, ctx.subject);
    await db.sequelize.transaction((transaction) => approvals.cancel(request.id, { transaction }));
    expect((await request.reload()).final_status).toBe("CANCELLED");
    expect((await api.get("/api/approvals/inbox", ctx.l1.token)).body.data.items).toEqual([]);
    expect(await db.ApprovalRequestLog.count({ where: { approval_request_id: request.id } })).toBe(1);
  });
});

describe("tenancy and access", () => {
  it("another company's request → 404; no token → 401; a staffing login → 403", async () => {
    const ctx = await setup();
    const other = await setup();
    const theirs = await raise(other, other.subject);
    expect((await approve(ctx.l1, theirs)).body).toEqual(errorBody("NOT_FOUND"));
    expect((await api.post(`/api/approvals/${crypto.randomUUID()}/approve`, ctx.l1.token, {})).status).toBe(404);
    expect((await api.get("/api/approvals/inbox", null)).status).toBe(401);
    const staffingUser = await db.User.create({ name: "Staff Co", email: `st-${crypto.randomUUID().slice(0, 8)}@hrms.test`, password: (await db.User.scope("withPassword").findByPk(ctx.l1.user.id)).password });
    await db.HrmsAccount.create({ user_id: staffingUser.id, employer_id: ctx.employer.id, access_level: "STAFFING_COMPANY", password_setup_required: false });
    const staffing = await loginAs(staffingUser.email);
    expect((await api.get("/api/approvals/inbox", staffing)).status).toBe(403);
    expect((await api.get("/api/approvals/inbox", other.l1.token)).body.data.items.map((i) => i.id)).toEqual([theirs.id]);
  });
});
