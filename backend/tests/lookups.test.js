const { db, short, errorBody, validationBody, ownerCompany, loginFor, createRole, api, NO_FLAGS } = require("./helpers/api");

// Roles and staffing-company lookups (ticket workforce#12b; workforce D48): read-only lists for
// the employee wizard and edit modal.

afterAll(async () => {
  await db.sequelize.close();
});

const staffingCompany = (employer, overrides = {}) =>
  db.StaffingCompany.create({ employer_id: employer.id, name: "Gulf Manpower", code: `GM-${short()}`, ...overrides });

describe("GET /api/roles", () => {
  it("lists the company's roles (id, name), sorted by name; another company's never appear", async () => {
    const ctx = await ownerCompany();
    const other = await ownerCompany();
    await db.Role.create({ employer_id: other.employer.id, name: "Their Role" });
    const zeta = await db.Role.create({ employer_id: ctx.employer.id, name: "Zeta Supervisor" });
    const alpha = await db.Role.create({ employer_id: ctx.employer.id, name: "Alpha Accountant" });
    const removed = await db.Role.create({ employer_id: ctx.employer.id, name: "Beta Removed" });
    await removed.destroy();
    const res = await api.get("/api/roles", ctx.token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [
        { id: alpha.id, name: "Alpha Accountant" },
        { id: zeta.id, name: "Zeta Supervisor" },
      ],
    });
  });

  it("a new company with no roles gets an empty list, not an error", async () => {
    const ctx = await ownerCompany();
    const res = await api.get("/api/roles", ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("GET /api/staffing-companies", () => {
  it("?status=ACTIVE lists the company's active staffing companies (id, name, code), sorted by name", async () => {
    const ctx = await ownerCompany();
    const other = await ownerCompany();
    await staffingCompany(other.employer, { name: "Their Agency" });
    const b = await staffingCompany(ctx.employer, { name: "Bright Staff", code: "BS-02" });
    const a = await staffingCompany(ctx.employer, { name: "Al Noor Manpower", code: null });
    await staffingCompany(ctx.employer, { name: "Closed Agency", status: "INACTIVE" });
    const res = await api.get("/api/staffing-companies", ctx.token, { query: { status: "ACTIVE" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [
        { id: a.id, name: "Al Noor Manpower", code: null },
        { id: b.id, name: "Bright Staff", code: "BS-02" },
      ],
    });
  });

  it("no status → all of them; INACTIVE → only inactive", async () => {
    const ctx = await ownerCompany();
    await staffingCompany(ctx.employer, { name: "A Active" });
    await staffingCompany(ctx.employer, { name: "B Inactive", status: "INACTIVE" });
    expect((await api.get("/api/staffing-companies", ctx.token)).body.data.map((s) => s.name)).toEqual(["A Active", "B Inactive"]);
    expect((await api.get("/api/staffing-companies", ctx.token, { query: { status: "INACTIVE" } })).body.data.map((s) => s.name)).toEqual([
      "B Inactive",
    ]);
  });

  it("an unknown status → 400 VALIDATION_FAILED on status", async () => {
    const ctx = await ownerCompany();
    const res = await api.get("/api/staffing-companies", ctx.token, { query: { status: "OPEN" } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ status: "VALIDATION_FAILED" }));
  });

  it("a company with none gets an empty list", async () => {
    const ctx = await ownerCompany();
    expect((await api.get("/api/staffing-companies", ctx.token, { query: { status: "ACTIVE" } })).body.data).toEqual([]);
  });
});

describe("permissions", () => {
  const calls = (token) => [api.get("/api/roles", token), api.get("/api/staffing-companies", token, { query: { status: "ACTIVE" } })];

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE"])("%s with employee:create or employee:update → 200", async (level) => {
    const ctx = await ownerCompany();
    for (const flags of [{ can_create: true }, { can_update: true }]) {
      const { token } = await loginFor(ctx.employer, level, { employee: { ...NO_FLAGS, ...flags } });
      for (const res of await Promise.all(calls(token))) expect(res.status).toBe(200);
    }
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE"])(
    "%s with neither (employee read/delete, or every flag on another module) → 403 FORBIDDEN",
    async (level) => {
      const ctx = await ownerCompany();
      const readDelete = (await loginFor(ctx.employer, level, { employee: { ...NO_FLAGS, can_read: true, can_delete: true } })).token;
      const noRole = (await loginFor(ctx.employer, level)).token;
      for (const token of [readDelete, noRole]) {
        for (const res of await Promise.all(calls(token))) {
          expect(res.status).toBe(403);
          expect(res.body).toEqual(errorBody("FORBIDDEN"));
          expect(res.body.message).toBe("You don't have permission to do this.");
        }
      }
    }
  );

  it("a STAFFING_COMPANY login → 403 FORBIDDEN even with employee:create; no token → 401", async () => {
    const ctx = await ownerCompany();
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { employee: { can_create: true, can_update: true } })).token;
    for (const res of await Promise.all(calls(staffing))) expect(res.body).toEqual(errorBody("FORBIDDEN"));
    for (const res of await Promise.all(calls(null))) expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("createRole's own role shows in the list (sanity: role fixtures are company roles)", async () => {
    const ctx = await ownerCompany();
    const role = await createRole(ctx.employer, { employee: { can_create: true } });
    expect((await api.get("/api/roles", ctx.token)).body.data).toEqual([{ id: role.id, name: role.name }]);
  });
});
