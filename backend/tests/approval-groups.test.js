const crypto = require("crypto");
const { db, MISSING_ID, errorBody, validationBody, ownerCompany, loginFor, createEmployee, createProject, assign, api, NO_FLAGS } = require("./helpers/api");

// Approval groups API (ticket workforce#10; workforce D17–D22, ADR 0011).

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const ALL = { can_read: true, can_create: true, can_update: true, can_delete: true };

// A company owner and three ACTIVE employees to be approvers.
const setup = async () => {
  const ctx = await ownerCompany();
  const [a, b, c] = [
    await createEmployee(ctx.employer, { full_name: "Ali Approver" }),
    await createEmployee(ctx.employer, { full_name: "Bina Approver" }),
    await createEmployee(ctx.employer, { full_name: "Chen Approver" }),
  ];
  return { ...ctx, a, b, c };
};
const body = (ctx, overrides = {}) => ({
  name: "HR Exit",
  code: "hr-exit",
  description: "Exits and resignations",
  members: [
    { employeeId: ctx.a.id, level: 1 },
    { employeeId: ctx.b.id, level: 2, isMandatory: false, canSkip: true },
  ],
  ...overrides,
});
const create = async (ctx, overrides) => {
  const res = await api.post("/api/approval-groups", ctx.token, body(ctx, overrides));
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.data;
};

describe("POST /api/approval-groups", () => {
  it("creates a group for all requests with ordered levels; the code is uppercased", async () => {
    const ctx = await setup();
    const res = await api.post("/api/approval-groups", ctx.token, body(ctx));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "HR Exit",
      code: "HR-EXIT",
      module: "ALL",
      scope: "GLOBAL",
      project: null,
      total_levels: 2,
      approver_count: 2,
      status: "ACTIVE",
      levels_without_active_approver: [],
      members: [
        { employee_id: ctx.a.id, name: "Ali Approver", level: 1, is_mandatory: true, can_skip: false },
        { employee_id: ctx.b.id, name: "Bina Approver", level: 2, is_mandatory: false, can_skip: true },
      ],
    });
  });

  it("a duplicate name (also of an inactive group) → 409 APPROVAL_GROUP_NAME_TAKEN; a duplicate code → 409 APPROVAL_GROUP_CODE_TAKEN", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    await db.ApprovalGroup.update({ is_active: false }, { where: { id: g.id } });
    const name = await api.post("/api/approval-groups", ctx.token, body(ctx, { name: "hr exit", code: "OTHER" }));
    expect(name.status).toBe(409);
    expect(name.body).toEqual(errorBody("APPROVAL_GROUP_NAME_TAKEN"));
    expect(name.body.message).toBe("An approval group with this name already exists.");
    const code = await api.post("/api/approval-groups", ctx.token, body(ctx, { name: "Other", code: "HR-exit" }));
    expect(code.body).toEqual(errorBody("APPROVAL_GROUP_CODE_TAKEN"));
    expect(code.body.message).toBe("An approval group with this code already exists.");
  });

  it.each([
    [{ name: undefined }, { name: "groupNameRequired" }],
    [{ name: "A" }, { name: "min2Chars" }],
    [{ name: "N".repeat(101) }, { name: "max100OrLess" }],
    [{ code: "" }, { code: "groupCodeRequired" }],
    [{ code: "C".repeat(51) }, { code: "max50OrLess" }],
    [{ description: "D".repeat(1001) }, { description: "max1000OrLess" }],
    [{ scope: "PROJECT" }, { projectId: "projectSelect" }],
  ])("%j → 400 with the §7.2 texts", async (overrides, errors) => {
    const ctx = await setup();
    const res = await api.post("/api/approval-groups", ctx.token, body(ctx, overrides));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(errors));
  });

  it("levels 1 and 3 → members 'Levels must start at 1 with no gaps.'", async () => {
    const ctx = await setup();
    const res = await api.post("/api/approval-groups", ctx.token, body(ctx, { members: [{ employeeId: ctx.a.id, level: 1 }, { employeeId: ctx.b.id, level: 3 }] }));
    expect(res.body).toEqual(validationBody({ members: "levelsContiguous" }));
    expect(res.body.errors.members).toBe("Levels must start at 1 with no gaps.");
  });

  it("no members / the same employee twice / an EXITED or other-company employee → their members texts", async () => {
    const ctx = await setup();
    const exited = await createEmployee(ctx.employer, { employment_status: "EXITED" });
    const theirs = await createEmployee((await ownerCompany()).employer);
    expect((await api.post("/api/approval-groups", ctx.token, body(ctx, { members: [] }))).body).toEqual(validationBody({ members: "approverRequired" }));
    expect((await api.post("/api/approval-groups", ctx.token, body(ctx, { members: undefined }))).body).toEqual(validationBody({ members: "approverRequired" }));
    expect(
      (await api.post("/api/approval-groups", ctx.token, body(ctx, { members: [{ employeeId: ctx.a.id, level: 1 }, { employeeId: ctx.a.id, level: 2 }] }))).body
    ).toEqual(validationBody({ members: "approverDuplicate" }));
    for (const id of [exited.id, theirs.id, crypto.randomUUID(), "nope"]) {
      expect((await api.post("/api/approval-groups", ctx.token, body(ctx, { members: [{ employeeId: id, level: 1 }] }))).body).toEqual(
        validationBody({ members: "departmentHeadInvalid" })
      );
    }
  });

  it("an IN_NOTICE employee can be an approver", async () => {
    const ctx = await setup();
    const leaving = await createEmployee(ctx.employer, { employment_status: "IN_NOTICE" });
    expect((await api.post("/api/approval-groups", ctx.token, body(ctx, { members: [{ employeeId: leaving.id, level: 1 }] }))).status).toBe(201);
  });

  it("a PROJECT group needs a company project and an approver on it", async () => {
    const ctx = await setup();
    const project = await createProject(ctx.employer);
    const none = await api.post("/api/approval-groups", ctx.token, body(ctx, { scope: "PROJECT", projectId: project.id }));
    expect(none.body).toEqual(validationBody({ members: "projectApproverRequired" }));
    expect(none.body.errors.members).toBe("At least one approver must be an employee of the selected project.");
    const theirs = await createProject((await ownerCompany()).employer);
    expect((await api.post("/api/approval-groups", ctx.token, body(ctx, { scope: "PROJECT", projectId: theirs.id }))).body).toEqual(
      validationBody({ projectId: "projectSelect" })
    );
    await assign(ctx.a, project);
    const ok = await api.post("/api/approval-groups", ctx.token, body(ctx, { scope: "PROJECT", projectId: project.id }));
    expect(ok.status).toBe(201);
    expect(ok.body.data.project).toEqual({ id: project.id, name: project.project_name, code: project.project_code });
  });

  it("any module other than ALL → 400 APPROVAL_ROUTING_PER_MODULE_DISABLED", async () => {
    const ctx = await setup();
    const res = await api.post("/api/approval-groups", ctx.token, body(ctx, { moduleKey: "LEAVE" }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("APPROVAL_ROUTING_PER_MODULE_DISABLED"));
    expect(res.body.message).toBe("Per-module routing isn't available yet.");
    expect((await api.post("/api/approval-groups", ctx.token, body(ctx, { moduleKey: "ALL" }))).status).toBe(201);
  });
});

describe("PUT /api/approval-groups/:id and /members", () => {
  it("edits the details", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    const res = await api.put(`/api/approval-groups/${g.id}`, ctx.token, { name: "HR Approvals", code: "hr-appr", description: null });
    expect(res.body.data).toMatchObject({ name: "HR Approvals", code: "HR-APPR", description: null, total_levels: 2 });
  });

  it("replaces the members: moved levels are updated, removed approvers are deactivated (not deleted)", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    const res = await api.put(`/api/approval-groups/${g.id}/members`, ctx.token, {
      members: [
        { employeeId: ctx.b.id, level: 1 },
        { employeeId: ctx.c.id, level: 1 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.total_levels).toBe(1);
    expect(res.body.data.members.map((m) => [m.employee_id, m.level])).toEqual(
      expect.arrayContaining([
        [ctx.b.id, 1],
        [ctx.c.id, 1],
      ])
    );
    const removed = await db.ApprovalGroupMember.findOne({ where: { approval_group_id: g.id, employee_id: ctx.a.id } });
    expect(removed.is_active).toBe(false);
  });

  it("member rules apply to the members update too", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    expect((await api.put(`/api/approval-groups/${g.id}/members`, ctx.token, { members: [{ employeeId: ctx.a.id, level: 2 }] })).body).toEqual(
      validationBody({ members: "levelsContiguous" })
    );
  });

  it("another company's group → 404", async () => {
    const ctx = await setup();
    const theirs = await create(await setup());
    expect((await api.put(`/api/approval-groups/${theirs.id}`, ctx.token, { name: "X Y", code: "XY" })).status).toBe(404);
    expect((await api.put(`/api/approval-groups/${theirs.id}/members`, ctx.token, { members: [{ employeeId: ctx.a.id, level: 1 }] })).status).toBe(404);
  });
});

describe("PATCH /api/approval-groups/:id/status", () => {
  it("deactivates an unused group and activates it again", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    expect((await api.patch(`/api/approval-groups/${g.id}/status`, ctx.token, { status: "INACTIVE" })).body.data.status).toBe("INACTIVE");
    expect((await api.patch(`/api/approval-groups/${g.id}/status`, ctx.token, { status: "ACTIVE" })).body.data.status).toBe("ACTIVE");
  });

  it("a group routed to a non-exited employee → 409 APPROVAL_GROUP_IN_USE; only exited ones → allowed", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    const routed = await createEmployee(ctx.employer);
    const routing = await db.EmployeeApprovalRouting.create({ employer_id: ctx.employer.id, employee_id: routed.id, module_key: "ALL", approval_group_id: g.id });
    const res = await api.patch(`/api/approval-groups/${g.id}/status`, ctx.token, { status: "INACTIVE" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("APPROVAL_GROUP_IN_USE"));
    expect(res.body.message).toBe("This approval group is in use and can't be removed.");
    await routed.update({ employment_status: "EXITED" });
    expect((await api.patch(`/api/approval-groups/${g.id}/status`, ctx.token, { status: "INACTIVE" })).status).toBe(200);
    await routing.destroy();
  });

  it("a group with a pending request → 409 APPROVAL_GROUP_IN_USE", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    await db.ApprovalRequest.create({
      employer_id: ctx.employer.id,
      approval_group_id: g.id,
      module_key: "EXIT",
      entity_type: "EMPLOYEE_EXIT",
      entity_id: crypto.randomUUID(),
      request_code: `EX-${crypto.randomUUID().slice(0, 8)}`,
      requested_by_user_id: ctx.owner.id,
      requested_at: new Date(),
    });
    expect((await api.patch(`/api/approval-groups/${g.id}/status`, ctx.token, { status: "INACTIVE" })).body).toEqual(errorBody("APPROVAL_GROUP_IN_USE"));
  });
});

describe("flags and lists", () => {
  it("a level whose approvers all left is flagged (levels_without_active_approver)", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    await ctx.b.update({ employment_status: "EXITED" });
    const res = await api.get(`/api/approval-groups/${g.id}`, ctx.token);
    expect(res.body.data.levels_without_active_approver).toEqual([2]);
    const list = await api.get("/api/approval-groups", ctx.token);
    expect(list.body.data.items[0].levels_without_active_approver).toEqual([2]);
  });

  it("lists newest first with search and status; approver options show ACTIVE/IN_NOTICE employees and who's on a project", async () => {
    const ctx = await setup();
    await create(ctx);
    await create(ctx, { name: "Finance", code: "FIN" });
    expect((await api.get("/api/approval-groups", ctx.token)).body.data.items.map((g) => g.code)).toEqual(["FIN", "HR-EXIT"]);
    expect((await api.get("/api/approval-groups", ctx.token, { query: { search: "fin" } })).body.data.items.map((g) => g.code)).toEqual(["FIN"]);
    expect((await api.get("/api/approval-groups", ctx.token, { query: { status: "INACTIVE" } })).body.data.total).toBe(0);
    const project = await createProject(ctx.employer);
    await assign(ctx.c, project);
    await createEmployee(ctx.employer, { employment_status: "EXITED", full_name: "Gone" });
    const options = (await api.get("/api/approval-groups/approver-options", ctx.token, { query: { projectId: project.id } })).body.data.items;
    expect(options.map((o) => [o.name, o.on_project])).toEqual([
      ["Ali Approver", false],
      ["Bina Approver", false],
      ["Chen Approver", true],
    ]);
    expect((await api.get(`/api/approval-groups/${MISSING_ID}`, ctx.token)).status).toBe(404);
  });
});

describe("permissions", () => {
  it("no approval_group flags → 403; read only can't change; staffing → 403; no token → 401", async () => {
    const ctx = await setup();
    const g = await create(ctx);
    const none = (await loginFor(ctx.employer, "SUB_ADMIN", { approval_group: NO_FLAGS })).token;
    for (const res of [
      await api.get("/api/approval-groups", none),
      await api.post("/api/approval-groups", none, body(ctx, { name: "X Y", code: "XY" })),
      await api.put(`/api/approval-groups/${g.id}`, none, { name: "X Y", code: "XY" }),
      await api.put(`/api/approval-groups/${g.id}/members`, none, { members: [{ employeeId: ctx.a.id, level: 1 }] }),
      await api.patch(`/api/approval-groups/${g.id}/status`, none, { status: "INACTIVE" }),
    ]) {
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    }
    const reader = (await loginFor(ctx.employer, "EMPLOYEE", { approval_group: { can_read: true } })).token;
    expect((await api.get(`/api/approval-groups/${g.id}`, reader)).status).toBe(200);
    expect((await api.patch(`/api/approval-groups/${g.id}/status`, reader, { status: "INACTIVE" })).status).toBe(403);
    const sub = (await loginFor(ctx.employer, "SUB_ADMIN", { approval_group: ALL })).token;
    expect((await api.post("/api/approval-groups", sub, body(ctx, { name: "Sub Made", code: "SUB" }))).status).toBe(201);
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { approval_group: ALL })).token;
    expect((await api.get("/api/approval-groups", staffing)).status).toBe(403);
    expect((await api.get("/api/approval-groups", null)).status).toBe(401);
  });
});
