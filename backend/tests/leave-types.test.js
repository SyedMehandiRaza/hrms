const { db, MISSING_ID, errorBody, validationBody, ownerCompany, loginFor, createEmployee, api, NO_FLAGS } = require("./helpers/api");

// Leave types / policies API (ticket workforce#08; workforce D30–D32).

const YEAR = new Date().getUTCFullYear();
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

const body = (overrides = {}) => ({
  name: "Annual Leave",
  code: "annual",
  yearly_quota: 21,
  accrual_method: "MONTHLY_ACCRUAL",
  monthly_accrual: 1.75,
  allow_carry_forward: true,
  max_carry_forward_days: 5,
  carry_forward_expiry_months: 3,
  allow_encashment: false,
  year_end_excess: "LAPSE",
  ...overrides,
});
const create = async (ctx, overrides) => {
  const res = await api.post("/api/leave-types", ctx.token, body(overrides));
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.data;
};

describe("POST /api/leave-types", () => {
  it("creates the type with its one policy; the code is uppercased; effective-from defaults to the FY start", async () => {
    const ctx = await ownerCompany();
    const res = await api.post("/api/leave-types", ctx.token, body());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Annual Leave",
      code: "ANNUAL",
      is_paid: true,
      allow_half_day: true,
      requires_document: false,
      is_active: true,
      yearly_quota: 21,
      accrual_method: "MONTHLY_ACCRUAL",
      monthly_accrual: 1.75,
      effective_from: `${YEAR}-01-01`,
      effective_to: null,
      allow_carry_forward: true,
      max_carry_forward_days: 5,
      carry_forward_expiry_months: 3,
      allow_encashment: false,
      year_end_excess: "LAPSE",
      prorate_joiners: true,
      allow_negative_balance: false,
      assigned_employees: 0,
    });
    expect(await db.LeavePolicy.count({ where: { leave_type_id: res.body.data.id } })).toBe(1);
  });

  it("ignores the monthly accrual for an UPFRONT policy", async () => {
    const ctx = await ownerCompany();
    const t = await create(ctx, { accrual_method: "UPFRONT", monthly_accrual: 3 });
    expect(t.monthly_accrual).toBe(0);
  });

  it("a duplicate name → 409 LEAVE_TYPE_NAME_TAKEN; a duplicate code → 409 LEAVE_TYPE_CODE_TAKEN", async () => {
    const ctx = await ownerCompany();
    await create(ctx);
    const name = await api.post("/api/leave-types", ctx.token, body({ name: "annual leave", code: "AL2" }));
    expect(name.status).toBe(409);
    expect(name.body).toEqual(errorBody("LEAVE_TYPE_NAME_TAKEN"));
    expect(name.body.message).toBe("A leave type with this name already exists.");
    const code = await api.post("/api/leave-types", ctx.token, body({ name: "Vacation", code: "Annual" }));
    expect(code.body).toEqual(errorBody("LEAVE_TYPE_CODE_TAKEN"));
    expect(code.body.message).toBe("A leave type with this code already exists.");
  });

  it.each([
    ["name", { name: undefined }, "leaveNameRequired"],
    ["name", { name: "A" }, "mustMin2Chars"],
    ["name", { name: "N".repeat(151) }, "max150Chars"],
    ["name", { name: "Annual 🌴" }, "emojisNotAllowed"],
    ["code", { code: "" }, "leaveCodeRequired"],
    ["code", { code: "ANNUALLEAVE" }, "leaveCodeFormat"],
    ["code", { code: "AL-1" }, "leaveCodeFormat"],
    ["yearly_quota", { yearly_quota: 366 }, "quotaRange"],
    ["yearly_quota", { yearly_quota: -1 }, "quotaRange"],
    ["accrual_method", { accrual_method: "WEEKLY" }, "accrualMethodRequired"],
    ["monthly_accrual", { monthly_accrual: -0.5 }, "monthlyAccrualNegative"],
    ["effective_to", { effective_from: `${YEAR}-06-01`, effective_to: `${YEAR}-06-01` }, "effectiveToAfter"],
    ["max_carry_forward_days", { max_carry_forward_days: 0 }, "maxCarryForward"],
    ["carry_forward_expiry_months", { carry_forward_expiry_months: 37 }, "carryExpiry"],
    ["carry_forward_expiry_months", { carry_forward_expiry_months: 1.5 }, "carryExpiry"],
    ["max_encashment_days", { allow_encashment: true, max_encashment_days: 0 }, "maxEncashment"],
    ["year_end_excess", { year_end_excess: "KEEP" }, "yearEndExcess"],
    ["is_paid", { is_paid: "maybe" }, "yesNo"],
  ])("a bad %s (%j) → 400 with its §7.2 text", async (field, overrides, key) => {
    const ctx = await ownerCompany();
    const res = await api.post("/api/leave-types", ctx.token, body(overrides));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ [field]: key }));
  });

  it("carry-forward and encashment maximums only matter when those are allowed", async () => {
    const ctx = await ownerCompany();
    const t = await create(ctx, { allow_carry_forward: false, max_carry_forward_days: 0, allow_encashment: false, max_encashment_days: 0 });
    expect(t).toMatchObject({ max_carry_forward_days: 0, max_encashment_days: 0 });
  });
});

describe("PUT /api/leave-types/:id", () => {
  it("changes the type and its policy in place (no new version)", async () => {
    const ctx = await ownerCompany();
    const t = await create(ctx);
    const res = await api.put(`/api/leave-types/${t.id}`, ctx.token, body({ yearly_quota: 30, is_paid: false }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: t.id, policy_id: t.policy_id, yearly_quota: 30, is_paid: false });
    expect(await db.LeavePolicy.count({ where: { leave_type_id: t.id } })).toBe(1);
  });

  it("deactivating keeps existing assignments; the type leaves the active list", async () => {
    const ctx = await ownerCompany();
    const t = await create(ctx);
    const employee = await createEmployee(ctx.employer);
    await db.EmployeeLeavePolicy.create({ employer_id: ctx.employer.id, employee_id: employee.id, leave_policy_id: t.policy_id, is_active: true });
    expect((await api.put(`/api/leave-types/${t.id}`, ctx.token, body({ is_active: false }))).body.data).toMatchObject({ is_active: false, assigned_employees: 1 });
    expect((await api.get("/api/leave-types", ctx.token, { query: { status: "ACTIVE" } })).body.data.items).toEqual([]);
    expect((await api.get("/api/leave-types", ctx.token, { query: { status: "INACTIVE" } })).body.data.items.map((i) => i.id)).toEqual([t.id]);
    expect(await db.EmployeeLeavePolicy.count({ where: { leave_policy_id: t.policy_id, is_active: true } })).toBe(1);
  });

  it("another company's type → 404", async () => {
    const ctx = await ownerCompany();
    const theirs = await create(await ownerCompany());
    expect((await api.put(`/api/leave-types/${theirs.id}`, ctx.token, body())).body).toEqual(errorBody("NOT_FOUND"));
  });
});

describe("POST /api/leave-types/:id/versions", () => {
  it("→ 409 LEAVE_POLICY_VERSIONING_DISABLED", async () => {
    const ctx = await ownerCompany();
    const t = await create(ctx);
    const res = await api.post(`/api/leave-types/${t.id}/versions`, ctx.token, {});
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("LEAVE_POLICY_VERSIONING_DISABLED"));
    expect(res.body.message).toBe("Policy versions aren't available yet.");
  });
});

describe("DELETE /api/leave-types/:id", () => {
  it("deletes a type that was never assigned (and its policy)", async () => {
    const ctx = await ownerCompany();
    const t = await create(ctx);
    expect((await api.delete(`/api/leave-types/${t.id}`, ctx.token)).body).toEqual({ success: true, data: { id: t.id } });
    expect(await db.LeaveType.findByPk(t.id)).toBeNull();
    expect((await api.post("/api/leave-types", ctx.token, body())).status).toBe(201);
  });

  it("a type that was ever assigned (even if ended) → 409 LEAVE_TYPE_IN_USE", async () => {
    const ctx = await ownerCompany();
    const t = await create(ctx);
    const employee = await createEmployee(ctx.employer);
    await db.EmployeeLeavePolicy.create({ employer_id: ctx.employer.id, employee_id: employee.id, leave_policy_id: t.policy_id, is_active: false, effective_to: `${YEAR}-03-01` });
    const res = await api.delete(`/api/leave-types/${t.id}`, ctx.token);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("LEAVE_TYPE_IN_USE"));
    expect(res.body.message).toBe("This leave type is assigned to employees and can't be deleted.");
  });
});

describe("GET /api/leave-types", () => {
  it("lists by name with search; detail; unknown id → 404", async () => {
    const ctx = await ownerCompany();
    const sick = await create(ctx, { name: "Sick Leave", code: "SICK" });
    await create(ctx);
    expect((await api.get("/api/leave-types", ctx.token)).body.data.items.map((i) => i.code)).toEqual(["ANNUAL", "SICK"]);
    expect((await api.get("/api/leave-types", ctx.token, { query: { search: "sic" } })).body.data.items.map((i) => i.code)).toEqual(["SICK"]);
    expect((await api.get(`/api/leave-types/${sick.id}`, ctx.token)).body.data.name).toBe("Sick Leave");
    expect((await api.get(`/api/leave-types/${MISSING_ID}`, ctx.token)).status).toBe(404);
    expect((await api.get("/api/leave-types", (await ownerCompany()).token)).body.data.total).toBe(0);
  });
});

describe("permissions", () => {
  it("no leave_type flags → 403; read only can't change; staffing login → 403; no token → 401", async () => {
    const ctx = await ownerCompany();
    const t = await create(ctx);
    const none = (await loginFor(ctx.employer, "SUB_ADMIN", { leave_type: NO_FLAGS })).token;
    for (const res of [
      await api.get("/api/leave-types", none),
      await api.post("/api/leave-types", none, body({ code: "X" })),
      await api.put(`/api/leave-types/${t.id}`, none, body()),
      await api.delete(`/api/leave-types/${t.id}`, none),
      await api.post(`/api/leave-types/${t.id}/versions`, none, {}),
    ]) {
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    }
    const reader = (await loginFor(ctx.employer, "EMPLOYEE", { leave_type: { can_read: true } })).token;
    expect((await api.get("/api/leave-types", reader)).status).toBe(200);
    expect((await api.put(`/api/leave-types/${t.id}`, reader, body())).status).toBe(403);
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { leave_type: { can_read: true } })).token;
    expect((await api.get("/api/leave-types", staffing)).status).toBe(403);
    expect((await api.get("/api/leave-types", null)).status).toBe(401);
  });
});
