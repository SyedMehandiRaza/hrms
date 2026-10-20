const crypto = require("crypto");
const { db, errorBody, validationBody, ownerCompany, createEmployee, loginAs, api } = require("./helpers/api");
const approvals = require("../src/services/approval.service");

// Approval edge rules (ticket workforce#11b; workforce D22a, D26, D27).

const onApproved = jest.fn();
const onRejected = jest.fn();
approvals.registerEntity("TEST_ENTITY", {
  moduleKey: "TEST",
  label: { en: "Test", ar: "اختبار" },
  codePrefix: "TST",
  onApproved: (...args) => onApproved(...args),
  onRejected: (...args) => onRejected(...args),
});

beforeEach(() => {
  onApproved.mockReset();
  onRejected.mockReset();
});
afterAll(async () => {
  await db.sequelize.close();
});

const approver = async (employer, name, overrides = {}) => {
  const employee = await createEmployee(employer, { full_name: name, ...overrides });
  await db.HrmsAccount.create({ user_id: employee.user_id, employer_id: employer.id, access_level: "EMPLOYEE", password_setup_required: false });
  const user = await db.User.findByPk(employee.user_id);
  return { employee, user, token: await loginAs(user.email) };
};

// levels: [[{ who, mandatory?, canSkip? }], …]
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
        employee_id: m.who.employee.id,
        level_no: i + 1,
        is_mandatory: m.mandatory ?? true,
        can_skip: m.canSkip ?? false,
      });
    }
  }
  return group;
};

const routeTo = (employer, employee, group) =>
  db.EmployeeApprovalRouting.create({ employer_id: employer.id, employee_id: employee.id, module_key: "ALL", approval_group_id: group.id });

const raise = (ctx, subject, raisedBy = { userId: ctx.owner.id, employeeId: null }) =>
  db.sequelize.transaction((transaction) =>
    approvals.raise({
      employerId: ctx.employer.id,
      entityType: "TEST_ENTITY",
      entityId: crypto.randomUUID(),
      subjectEmployeeId: subject.id,
      raisedBy,
      transaction,
    })
  );

const approve = (who, request, body = {}) => api.post(`/api/approvals/${request.id}/approve`, who.token, body);
const reject = (who, request, reason = "Not this time") => api.post(`/api/approvals/${request.id}/reject`, who.token, { reason });
const logsOf = (request) => db.ApprovalRequestLog.findAll({ where: { approval_request_id: request.id }, order: [["level_no", "ASC"], ["created_at", "ASC"]], raw: true });

describe("who can't act (D26)", () => {
  it("the subject employee is absent at a level they're on; the others decide", async () => {
    const ctx = await ownerCompany();
    const subject = await approver(ctx.employer, "Sami Subject");
    const other = await approver(ctx.employer, "Omar Other");
    const group = await makeGroup(ctx.employer, [[{ who: subject }, { who: other }]]);
    await routeTo(ctx.employer, subject.employee, group);
    const request = await raise(ctx, subject.employee);
    const res = await approve(subject, request);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("APPROVAL_NOT_YOUR_TURN"));
    expect(res.body.message).toBe("This request isn't waiting for your approval.");
    expect((await api.get("/api/approvals/inbox", subject.token)).body.data.items).toEqual([]);
    expect((await approve(other, request)).status).toBe(200);
    expect((await request.reload()).final_status).toBe("APPROVED");
  });

  it("the raiser is absent too", async () => {
    const ctx = await ownerCompany();
    const raiser = await approver(ctx.employer, "Rana Raiser");
    const other = await approver(ctx.employer, "Omar Other");
    const group = await makeGroup(ctx.employer, [[{ who: raiser }, { who: other }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    const request = await raise(ctx, subject, { userId: raiser.user.id, employeeId: raiser.employee.id });
    expect((await approve(raiser, request)).body).toEqual(errorBody("APPROVAL_NOT_YOUR_TURN"));
    expect((await approve(other, request)).status).toBe(200);
  });

  it("an EXITED approver drops out of every pending level; an IN_NOTICE approver can still approve", async () => {
    const ctx = await ownerCompany();
    const leaving = await approver(ctx.employer, "Lea Leaving", { employment_status: "IN_NOTICE" });
    const gone = await approver(ctx.employer, "Gus Gone");
    const group = await makeGroup(ctx.employer, [[{ who: leaving }, { who: gone }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    const request = await raise(ctx, subject);
    await gone.employee.update({ employment_status: "EXITED" });
    // Only the IN_NOTICE approver is left (and mandatory) — approving completes the level.
    expect((await approve(leaving, request)).status).toBe(200);
    expect((await request.reload()).final_status).toBe("APPROVED");
  });
});

describe("a level with nobody left (D26)", () => {
  it("every approver marked Can skip → logged SKIPPED and the request moves on", async () => {
    const ctx = await ownerCompany();
    const gone = await approver(ctx.employer, "Gus Gone", { employment_status: "EXITED" });
    const l2 = await approver(ctx.employer, "Lars Two");
    const group = await makeGroup(ctx.employer, [[{ who: gone, canSkip: true }], [{ who: l2 }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    const request = await raise(ctx, subject);
    await request.reload();
    expect(request.current_level).toBe(2);
    expect((await logsOf(request)).map((l) => [l.level_no, l.status])).toEqual([
      [1, "SKIPPED"],
      [2, "PENDING"],
    ]);
    expect((await api.get("/api/approvals/inbox", l2.token)).body.data.items.map((i) => i.id)).toEqual([request.id]);
  });

  it("skipping the last level approves the request", async () => {
    const ctx = await ownerCompany();
    const gone = await approver(ctx.employer, "Gus Gone", { employment_status: "EXITED" });
    const group = await makeGroup(ctx.employer, [[{ who: gone, canSkip: true }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    const request = await raise(ctx, subject);
    expect((await request.reload()).final_status).toBe("APPROVED");
    expect(onApproved).toHaveBeenCalledTimes(1);
  });

  it("without every approver marked Can skip the request stays at that level (blocked) and shows on the owner's inbox", async () => {
    const ctx = await ownerCompany();
    const goneA = await approver(ctx.employer, "Gus Gone", { employment_status: "EXITED" });
    const goneB = await approver(ctx.employer, "Gia Gone", { employment_status: "EXITED" });
    const group = await makeGroup(ctx.employer, [[{ who: goneA, canSkip: true }, { who: goneB, canSkip: false }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    const request = await raise(ctx, subject);
    await request.reload();
    expect([request.current_level, request.final_status]).toEqual([1, "PENDING"]);
    const ownerInbox = (await api.get("/api/approvals/inbox", ctx.token)).body.data.items;
    expect(ownerInbox).toEqual([expect.objectContaining({ id: request.id, blocked: true, owner_only: false })]);
  });
});

describe("owner override (D27)", () => {
  const blockedRequest = async () => {
    const ctx = await ownerCompany();
    const gone = await approver(ctx.employer, "Gus Gone", { employment_status: "EXITED" });
    const l2 = await approver(ctx.employer, "Lars Two");
    const group = await makeGroup(ctx.employer, [[{ who: gone }], [{ who: l2 }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    return { ...ctx, l2, request: await raise(ctx, subject) };
  };

  it("the owner approves the current level on someone's behalf with a reason → an override log row; it moves on", async () => {
    const ctx = await blockedRequest();
    const res = await api.post(`/api/approvals/${ctx.request.id}/approve`, ctx.token, { reason: "Approver has left the company" });
    expect(res.status).toBe(200);
    await ctx.request.reload();
    expect(ctx.request.current_level).toBe(2);
    const override = (await logsOf(ctx.request)).find((l) => l.is_override);
    expect(override).toMatchObject({ level_no: 1, status: "APPROVED", actor_user_id: ctx.owner.id, approval_group_member_id: null, employee_id: null, comments: "Approver has left the company" });
  });

  it.each([undefined, "", "shrt"])("an override without a valid reason (%j) → 400 reason 'Reason must be 5–500 characters'", async (reason) => {
    const ctx = await blockedRequest();
    const res = await api.post(`/api/approvals/${ctx.request.id}/approve`, ctx.token, reason === undefined ? {} : { reason });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ reason: "reason5to500" }));
    expect((await ctx.request.reload()).current_level).toBe(1);
  });

  it("the owner can reject on someone's behalf", async () => {
    const ctx = await blockedRequest();
    expect((await api.post(`/api/approvals/${ctx.request.id}/reject`, ctx.token, { reason: "Exit is not justified" })).status).toBe(200);
    await ctx.request.reload();
    expect(ctx.request.final_status).toBe("REJECTED");
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it("the owner decides an owner-only request the same way", async () => {
    const ctx = await ownerCompany();
    const loner = await createEmployee(ctx.employer);
    const request = await raise(ctx, loner);
    expect((await api.post(`/api/approvals/${request.id}/approve`, ctx.token, { reason: "Reviewed by owner" })).status).toBe(200);
    expect((await request.reload()).final_status).toBe("APPROVED");
    expect(onApproved).toHaveBeenCalledTimes(1);
  });
});

describe("group edits while requests are pending (D22a)", () => {
  it("a members change re-evaluates pending requests at once (a now-complete level moves on)", async () => {
    const ctx = await ownerCompany();
    const [a, b, c] = [await approver(ctx.employer, "A A"), await approver(ctx.employer, "B B"), await approver(ctx.employer, "C C")];
    const group = await makeGroup(ctx.employer, [[{ who: a }, { who: b }], [{ who: c }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    const request = await raise(ctx, subject);
    await approve(a, request);
    expect((await request.reload()).current_level).toBe(1);
    const res = await api.put(`/api/approval-groups/${group.id}/members`, ctx.token, {
      members: [
        { employeeId: a.employee.id, level: 1 },
        { employeeId: c.employee.id, level: 2 },
      ],
    });
    expect(res.status).toBe(200);
    expect((await request.reload()).current_level).toBe(2);
  });

  it("removing a level a pending request still needs → 409 APPROVAL_GROUP_HAS_PENDING", async () => {
    const ctx = await ownerCompany();
    const [a, c] = [await approver(ctx.employer, "A A"), await approver(ctx.employer, "C C")];
    const group = await makeGroup(ctx.employer, [[{ who: a }], [{ who: c }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    await raise(ctx, subject);
    const res = await api.put(`/api/approval-groups/${group.id}/members`, ctx.token, { members: [{ employeeId: a.employee.id, level: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("APPROVAL_GROUP_HAS_PENDING"));
    expect(res.body.message).toBe("This group has pending requests. Decide them before removing levels.");
  });
});

describe("turns and concurrency", () => {
  const twoLevels = async ({ anyOne = false } = {}) => {
    const ctx = await ownerCompany();
    const [a, b, c] = [await approver(ctx.employer, "A A"), await approver(ctx.employer, "B B"), await approver(ctx.employer, "C C")];
    const group = await makeGroup(ctx.employer, [[{ who: a, mandatory: !anyOne }, { who: b, mandatory: !anyOne }], [{ who: c }]]);
    const subject = await createEmployee(ctx.employer);
    await routeTo(ctx.employer, subject, group);
    return { ...ctx, a, b, c, request: await raise(ctx, subject) };
  };

  it("an approver of another level → 403 APPROVAL_NOT_YOUR_TURN", async () => {
    const ctx = await twoLevels();
    expect((await approve(ctx.c, ctx.request)).body).toEqual(errorBody("APPROVAL_NOT_YOUR_TURN"));
  });

  it("two approvers deciding the same level at the same time → one wins, the other gets 409 APPROVAL_ALREADY_DECIDED", async () => {
    const ctx = await twoLevels({ anyOne: true });
    const results = await Promise.all([approve(ctx.a, ctx.request), approve(ctx.b, ctx.request)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409).body).toEqual(errorBody("APPROVAL_ALREADY_DECIDED"));
    expect((await ctx.request.reload()).current_level).toBe(2);
  });

  it("deciding again after your own decision → 409 APPROVAL_ALREADY_DECIDED", async () => {
    const ctx = await twoLevels();
    await approve(ctx.a, ctx.request);
    expect((await approve(ctx.a, ctx.request)).body).toEqual(errorBody("APPROVAL_ALREADY_DECIDED"));
  });

  it.each(["APPROVED", "REJECTED", "CANCELLED"])("acting on a %s request → 409 APPROVAL_ALREADY_DECIDED", async (status) => {
    const ctx = await twoLevels();
    await ctx.request.update({ final_status: status });
    expect((await approve(ctx.a, ctx.request)).body).toEqual(errorBody("APPROVAL_ALREADY_DECIDED"));
    expect((await reject(ctx.a, ctx.request)).body).toEqual(errorBody("APPROVAL_ALREADY_DECIDED"));
    expect((await api.post(`/api/approvals/${ctx.request.id}/approve`, ctx.token, { reason: "Owner trying" })).body).toEqual(
      errorBody("APPROVAL_ALREADY_DECIDED")
    );
  });
});
