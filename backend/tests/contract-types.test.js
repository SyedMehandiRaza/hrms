const h = require("./helpers/contracts");

const { db, api, errorBody, validationBody, createCompany, hrLogin, ownerToken, createEmployee, createStaffingCompany } = h;

// Contract types API (ticket contract-studio#03; plan decisions 15–17).

afterAll(() => db.sequelize.close());

const list = (token, query) => api.get("/contract-types", token, { query });
const create = (token, body, lang) => api.post("/contract-types", token, body, { lang });
const update = (token, id, body) => api.put(`/contract-types/${id}`, token, body);
const remove = (token, id) => api.delete(`/contract-types/${id}`, token);
const get = (token, id) => api.get(`/contract-types/${id}`, token);

const newType = (employer, overrides = {}) =>
  db.ContractType.create({ employer_id: employer.id, name: `Type ${h.short()}`, code: `T${h.short()}`.toUpperCase(), ...overrides });

describe("list", () => {
  let company;
  let token;

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
    await newType(company.employer, { name: "Employment Contract", code: "EMP", description: "Standard" });
    await newType(company.employer, { name: "Extension", code: "EXT" });
    await newType(company.employer, { name: "Old Amendment", code: "AMD", is_active: false });
    await newType((await createCompany()).employer, { name: "Employment Contract", code: "EMP" });
  });

  it("lists the company's types, paginated", async () => {
    const res = await list(token, { limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(res.body.data.items).toHaveLength(2);
    const all = (await list(token, { limit: 50 })).body.data.items;
    expect(all.find((t) => t.code === "EMP")).toMatchObject({
      name: "Employment Contract",
      code: "EMP",
      description: "Standard",
      is_active: true,
    });
  });

  it("searches name or code", async () => {
    expect((await list(token, { search: "extens" })).body.data.items.map((t) => t.code)).toEqual(["EXT"]);
    expect((await list(token, { search: "amd" })).body.data.items.map((t) => t.code)).toEqual(["AMD"]);
  });

  it("filters active or inactive types", async () => {
    expect((await list(token, { status: "INACTIVE" })).body.data.items.map((t) => t.code)).toEqual(["AMD"]);
    expect((await list(token, { status: "ACTIVE" })).body.data.items.map((t) => t.code).sort()).toEqual(["EMP", "EXT"]);
  });

  it("opens one type", async () => {
    const type = await newType(company.employer, { name: "Viewable", code: "VIEW" });
    const res = await get(token, type.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: type.id, name: "Viewable", code: "VIEW" });
  });
});

describe("create", () => {
  let company;
  let token;

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
  });

  it("creates 'Extension' with code 'ext' → 201 and stores code EXT", async () => {
    const res = await create(token, { name: "Extension", code: "ext", description: "Extends a contract" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Extension", code: "EXT", description: "Extends a contract", is_active: true });
    const row = await db.ContractType.findByPk(res.body.data.id);
    expect(row.code).toBe("EXT");
    expect(row.employer_id).toBe(company.employer.id);
    expect(row.created_by).toBe(company.owner.id);
  });

  it("refuses 'extension' while 'Extension' exists → 409 CONTRACT_TYPE_NAME_TAKEN", async () => {
    await create(token, { name: "Renewal", code: "REN" });
    const res = await create(token, { name: "renewal", code: "REN2" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_TYPE_NAME_TAKEN"));
  });

  it("refuses a code already in use (any case) → 409 CONTRACT_TYPE_CODE_TAKEN", async () => {
    await create(token, { name: "Secondment", code: "SEC" });
    const res = await create(token, { name: "Secondment 2", code: "sec" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_TYPE_CODE_TAKEN"));
  });

  it("allows the same name and code in another company", async () => {
    await create(token, { name: "Shared Name", code: "SHARED" });
    const other = await createCompany();
    const res = await create(await ownerToken(other), { name: "Shared Name", code: "SHARED" });
    expect(res.status).toBe(201);
  });

  it.each([
    [{}, { name: "contractTypeNameRequired", code: "codeRequired" }],
    [{ name: "  ", code: "  " }, { name: "contractTypeNameRequired", code: "codeRequired" }],
    [{ name: "A", code: "B" }, { name: "nameMin", code: "codeMin" }],
    [{ name: "n".repeat(151), code: "c".repeat(101) }, { name: "contractTypeNameMax", code: "codeMax100" }],
    [{ name: "Type 😀", code: "C😀" }, { name: "noEmojis", code: "noEmojis" }],
    [{ name: "Valid", code: "VALID", description: "d".repeat(501) }, { description: "descriptionMax500" }],
  ])("400 VALIDATION_FAILED for %j", async (body, fields) => {
    const res = await create(token, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody(fields));
  });

  it("answers validation errors in Arabic", async () => {
    const res = await create(token, {}, "ar");
    expect(res.body).toEqual(validationBody({ name: "contractTypeNameRequired", code: "codeRequired" }, "ar"));
  });
});

describe("edit, deactivate and delete", () => {
  let company;
  let token;

  beforeAll(async () => {
    company = await createCompany();
    token = await ownerToken(company);
  });

  it("edits a type and deactivates it; templates using it keep their type", async () => {
    const type = await newType(company.employer, { name: "Before", code: "BEF" });
    const template = await db.ContractTemplate.create({ employer_id: company.employer.id, name: "T", contract_type_id: type.id });
    const res = await update(token, type.id, { name: "After", code: "aft", description: "", is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "After", code: "AFT", description: null, is_active: false });
    expect((await template.reload()).contract_type_id).toBe(type.id);
  });

  it("refuses a duplicate name or code on edit, but allows keeping its own", async () => {
    const a = await newType(company.employer, { name: "Alpha", code: "ALPHA" });
    await newType(company.employer, { name: "Beta", code: "BETA" });
    expect((await update(token, a.id, { name: "Alpha", code: "ALPHA" })).status).toBe(200);
    expect((await update(token, a.id, { name: "BETA", code: "ALPHA" })).body).toEqual(errorBody("CONTRACT_TYPE_NAME_TAKEN"));
    expect((await update(token, a.id, { name: "Alpha", code: "beta" })).body).toEqual(errorBody("CONTRACT_TYPE_CODE_TAKEN"));
  });

  it("refuses to delete a type used by a template → 409 CONTRACT_TYPE_IN_USE", async () => {
    const type = await newType(company.employer);
    await db.ContractTemplate.create({ employer_id: company.employer.id, name: "T", contract_type_id: type.id });
    const res = await remove(token, type.id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("CONTRACT_TYPE_IN_USE"));
  });

  it("refuses to delete a type used by a contract (even a deleted draft)", async () => {
    const type = await newType(company.employer);
    const contract = await db.Contract.create({ employer_id: company.employer.id, name: "C", contract_type_id: type.id });
    await contract.destroy();
    expect((await remove(token, type.id)).body).toEqual(errorBody("CONTRACT_TYPE_IN_USE"));
  });

  it("hard-deletes an unused type, after which its name and code can be reused", async () => {
    const type = await newType(company.employer, { name: "Temporary", code: "TEMP" });
    const res = await remove(token, type.id);
    expect(res.status).toBe(200);
    expect(await db.ContractType.findByPk(type.id)).toBeNull();
    expect((await list(token, { search: "Temporary" })).body.data.items).toEqual([]);
    expect((await create(token, { name: "Temporary", code: "TEMP" })).status).toBe(201);
  });

  it.each(["get", "update", "remove"])("404 for another company's type (%s)", async (action) => {
    const foreign = await newType((await createCompany()).employer);
    const calls = { get: () => get(token, foreign.id), update: () => update(token, foreign.id, { name: "X1", code: "X1" }), remove: () => remove(token, foreign.id) };
    const res = await calls[action]();
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
    expect(await db.ContractType.findByPk(foreign.id)).not.toBeNull();
  });

  it("404 for a malformed id", async () => {
    expect((await get(token, "nope")).status).toBe(404);
  });
});

describe("auth and permissions", () => {
  let company;
  let type;

  beforeAll(async () => {
    company = await createCompany();
    type = await newType(company.employer);
  });

  const calls = (id) => ({
    read: (t) => list(t),
    readOne: (t) => get(t, id),
    create: (t) => create(t, { name: `N ${h.short()}`, code: `C${h.short()}` }),
    update: (t) => update(t, id, { name: `U ${h.short()}`, code: `U${h.short()}` }),
    delete: (t) => remove(t, id),
  });
  const FLAG = { read: "can_read", readOne: "can_read", create: "can_create", update: "can_update", delete: "can_delete" };

  it("401 without a token", async () => {
    const res = await list(undefined);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it.each(Object.keys(FLAG))("%s: allowed with its flag, 403 with every other flag", async (action) => {
    const target = await newType(company.employer);
    const others = Object.fromEntries(["can_read", "can_create", "can_update", "can_delete"].filter((f) => f !== FLAG[action]).map((f) => [f, true]));
    const denied = await hrLogin(company.employer, others);
    const res = await calls(target.id)[action](denied.token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    const allowed = await hrLogin(company.employer, { [FLAG[action]]: true });
    expect([200, 201]).toContain((await calls(target.id)[action](allowed.token)).status);
  });

  it("403 for the employee and the staffing company on every call", async () => {
    const { user: emp } = await createEmployee(company.employer);
    const { user: staff } = await createStaffingCompany(company.employer);
    for (const user of [emp, staff]) {
      const token = await h.loginAs(user.email);
      for (const call of Object.values(calls(type.id))) {
        const res = await call(token);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(errorBody("FORBIDDEN"));
      }
    }
  });

  it("allows the owner with no role", async () => {
    const token = await ownerToken(company);
    expect((await list(token)).status).toBe(200);
    expect((await create(token, { name: "Owner Made", code: "OWN" })).status).toBe(201);
  });
});
