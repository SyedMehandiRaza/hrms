const { db, MISSING_ID, errorBody, validationBody, ownerCompany, loginFor, createEmployee, api, NO_FLAGS } = require("./helpers/api");
const { build } = require("./helpers/factory");
const { addStarterSalaryComponents } = require("../src/utils/starterSalaryComponents");

// Salary components API (ticket workforce#09; workforce D41–D43).

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await db.sequelize.close();
});

// A company with the starter components, as sign-up creates.
const setup = async () => {
  const ctx = await ownerCompany();
  await addStarterSalaryComponents(db.sequelize, ctx.employer.id);
  return ctx;
};
const byCode = (ctx, code) => db.SalaryComponent.findOne({ where: { employer_id: ctx.employer.id, code } });
const create = async (ctx, overrides = {}) => {
  const res = await api.post("/api/salary-components", ctx.token, { name: "Site Allowance", type: "EARNING", ...overrides });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.data;
};
const useOnSalary = async (ctx, componentId) => {
  const employee = await createEmployee(ctx.employer);
  const salary = await build(db, "EmployeeSalary", { employee_id: employee.id, employer_id: ctx.employer.id });
  await build(db, "EmployeeSalaryComponent", { employee_salary_id: salary.id, salary_component_id: componentId });
};

describe("POST /api/salary-components", () => {
  it("creates a component with a code from its name", async () => {
    const ctx = await setup();
    const res = await api.post("/api/salary-components", ctx.token, { name: "Site Allowance", type: "EARNING", description: "Remote sites" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Site Allowance",
      code: "SITE_ALLOWANCE",
      type: "EARNING",
      description: "Remote sites",
      is_default: false,
      is_system: false,
      status: "ACTIVE",
      used_on_salaries: 0,
    });
  });

  it("a code that's taken gets a suffix; a code sent by the client is ignored", async () => {
    const ctx = await setup();
    await create(ctx, { name: "Night-Shift Bonus!" });
    const second = await create(ctx, { name: "Night Shift Bonus", code: "MINE" });
    expect(second.code).toBe("NIGHT_SHIFT_BONUS_2");
    expect((await create(ctx, { name: "Basic Salary (extra)" })).code).toBe("BASIC_SALARY_EXTRA");
  });

  it("a duplicate name (any case) → 409 SALARY_COMPONENT_NAME_TAKEN", async () => {
    const ctx = await setup();
    const res = await api.post("/api/salary-components", ctx.token, { name: "basic salary", type: "EARNING" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("SALARY_COMPONENT_NAME_TAKEN"));
    expect(res.body.message).toBe("A salary component with this name already exists.");
  });

  it.each([
    [{ type: "EARNING" }, { name: "componentNameRequired" }],
    [{ name: "A", type: "EARNING" }, { name: "componentNameLength" }],
    [{ name: "N".repeat(101), type: "EARNING" }, { name: "componentNameLength" }],
    [{ name: "Bonus 💰", type: "EARNING" }, { name: "emojisNotAllowed" }],
    [{ name: "Bonus" }, { type: "componentTypeRequired" }],
    [{ name: "Bonus", type: "TAX" }, { type: "componentTypeRequired" }],
    [{ name: "Bonus", type: "EARNING", description: "D".repeat(256) }, { description: "descriptionMax255" }],
  ])("%j → 400 with the §7.2 texts", async (input, errors) => {
    const ctx = await setup();
    const res = await api.post("/api/salary-components", ctx.token, input);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(errors));
  });
});

describe("system and default components", () => {
  it.each(["BASIC", "HOUSING", "TRANSPORT", "HOURLY"])("editing or deactivating %s → 403 SALARY_COMPONENT_SYSTEM", async (code) => {
    const ctx = await setup();
    const c = await byCode(ctx, code);
    const edit = await api.put(`/api/salary-components/${c.id}`, ctx.token, { name: "Renamed", type: c.type });
    expect(edit.status).toBe(403);
    expect(edit.body).toEqual(errorBody("SALARY_COMPONENT_SYSTEM"));
    expect(edit.body.message).toBe("Default components can't be changed.");
    expect((await api.delete(`/api/salary-components/${c.id}`, ctx.token)).body).toEqual(errorBody("SALARY_COMPONENT_SYSTEM"));
    expect((await c.reload()).is_active).toBe(true);
  });
});

describe("PUT /api/salary-components/:id", () => {
  it("edits a non-system component; the code never changes", async () => {
    const ctx = await setup();
    const c = await create(ctx);
    const res = await api.put(`/api/salary-components/${c.id}`, ctx.token, { name: "Remote Site Allowance", type: "DEDUCTION", status: "INACTIVE" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Remote Site Allowance", code: "SITE_ALLOWANCE", type: "DEDUCTION", status: "INACTIVE" });
  });

  it("changing the type of a component used on a salary → 409 SALARY_COMPONENT_TYPE_LOCKED; renaming it is fine", async () => {
    const ctx = await setup();
    const food = await byCode(ctx, "FOOD");
    await useOnSalary(ctx, food.id);
    const res = await api.put(`/api/salary-components/${food.id}`, ctx.token, { name: "Food Allowance", type: "DEDUCTION" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("SALARY_COMPONENT_TYPE_LOCKED"));
    expect(res.body.message).toBe("The type can't change once employees use this component.");
    expect((await api.put(`/api/salary-components/${food.id}`, ctx.token, { name: "Meal Allowance", type: "EARNING" })).status).toBe(200);
  });

  it("taking another component's name → 409; another company's component → 404", async () => {
    const ctx = await setup();
    const c = await create(ctx);
    expect((await api.put(`/api/salary-components/${c.id}`, ctx.token, { name: "GOSI Contribution", type: "EARNING" })).body).toEqual(
      errorBody("SALARY_COMPONENT_NAME_TAKEN")
    );
    const other = await setup();
    const theirs = await byCode(other, "FOOD");
    expect((await api.put(`/api/salary-components/${theirs.id}`, ctx.token, { name: "X Y", type: "EARNING" })).status).toBe(404);
  });
});

describe("DELETE /api/salary-components/:id (deactivate)", () => {
  it("deactivates: it leaves the active list, salaries that use it keep it", async () => {
    const ctx = await setup();
    const food = await byCode(ctx, "FOOD");
    await useOnSalary(ctx, food.id);
    const res = await api.delete(`/api/salary-components/${food.id}`, ctx.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "INACTIVE", used_on_salaries: 1 });
    const active = (await api.get("/api/salary-components", ctx.token, { query: { status: "ACTIVE", limit: 50 } })).body.data.items;
    expect(active.map((i) => i.code)).not.toContain("FOOD");
    expect(await db.EmployeeSalaryComponent.count({ where: { salary_component_id: food.id } })).toBe(1);
  });
});

describe("GET /api/salary-components", () => {
  it("lists defaults first with their flags, and filters by type, status and search", async () => {
    const ctx = await setup();
    const items = (await api.get("/api/salary-components", ctx.token)).body.data.items;
    expect(items.slice(0, 3).map((i) => [i.code, i.is_default, i.is_system])).toEqual([
      ["BASIC", true, true],
      ["HOUSING", true, true],
      ["TRANSPORT", true, true],
    ]);
    expect(items.find((i) => i.code === "HOURLY")).toMatchObject({ is_default: false, is_system: true });
    const deductions = (await api.get("/api/salary-components", ctx.token, { query: { type: "DEDUCTION" } })).body.data.items;
    expect(deductions.map((i) => i.code).sort()).toEqual(["ABSENCE", "ADVANCE", "GOSI"]);
    expect((await api.get("/api/salary-components", ctx.token, { query: { search: "trans" } })).body.data.items.map((i) => i.code)).toEqual(["TRANSPORT"]);
    expect((await api.get(`/api/salary-components/${MISSING_ID}`, ctx.token)).status).toBe(404);
  });
});

describe("permissions (salary, not payroll)", () => {
  it("payroll flags don't count; salary read only can't change; staffing → 403; no token → 401", async () => {
    const ctx = await setup();
    const c = await create(ctx);
    const payrollOnly = (await loginFor(ctx.employer, "SUB_ADMIN", { payroll: { can_read: true, can_create: true }, salary: NO_FLAGS })).token;
    expect((await api.get("/api/salary-components", payrollOnly)).body).toEqual(errorBody("FORBIDDEN"));
    const reader = (await loginFor(ctx.employer, "EMPLOYEE", { salary: { can_read: true } })).token;
    expect((await api.get("/api/salary-components", reader)).status).toBe(200);
    expect((await api.post("/api/salary-components", reader, { name: "X Y", type: "EARNING" })).status).toBe(403);
    expect((await api.put(`/api/salary-components/${c.id}`, reader, { name: "X Y", type: "EARNING" })).status).toBe(403);
    expect((await api.delete(`/api/salary-components/${c.id}`, reader)).status).toBe(403);
    const staffing = (await loginFor(ctx.employer, "STAFFING_COMPANY", { salary: { can_read: true } })).token;
    expect((await api.get("/api/salary-components", staffing)).status).toBe(403);
    expect((await api.get("/api/salary-components", null)).status).toBe(401);
  });
});
