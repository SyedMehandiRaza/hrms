const crypto = require("crypto");
const request = require("supertest");
const bcrypt = require("bcrypt");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");

// Designations API: a department's list, dropdown, create, edit, delete
// (ticket auth-company#13; D32, D33, D37).

const PASSWORD = "Test@12345";

const errorBody = (code, lang = "en") => ({ success: false, code, message: MESSAGES[code][lang] });
const fieldText = (key, lang = "en") => (FIELD_MESSAGES[key] || MESSAGES[key])[lang];
const validationBody = (fields, lang = "en") => ({
  ...errorBody("VALIDATION_FAILED", lang),
  errors: Object.fromEntries(Object.entries(fields).map(([field, key]) => [field, fieldText(key, lang)])),
});

let passwordHash;
let designationModule;
let otherModule;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  [designationModule] = await db.Module.findOrCreate({ where: { module_key: "designation" }, defaults: { name: "Designations" } });
  [otherModule] = await db.Module.findOrCreate({ where: { module_key: "department" }, defaults: { name: "Departments" } });
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  await db.sequelize.close();
});

// ---------- helpers ----------

const short = () => crypto.randomUUID().slice(0, 8);
const uniqueEmail = (prefix) => `${prefix}-${short()}@hrms.test`;

const createCompany = async () => {
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: passwordHash });
  const employer = await db.Employer.create({ user_id: owner.id, company_name: "Al Noor Construction", employer_status: "ACTIVE" });
  await db.HrmsAccount.create({ user_id: owner.id, employer_id: employer.id, access_level: "ADMIN", password_setup_required: false });
  return { owner, employer };
};

const NO_FLAGS = { can_read: false, can_create: false, can_update: false, can_delete: false };
const ALL_FLAGS = { can_read: true, can_create: true, can_update: true, can_delete: true };

const createRole = async (employer, flags) => {
  const role = await db.Role.create({ employer_id: employer.id, name: `Role ${short()}` });
  await db.RolePermission.create({ role_id: role.id, module_id: designationModule.id, ...NO_FLAGS, ...flags });
  // A flag on another module (department) must not count.
  await db.RolePermission.create({ role_id: role.id, module_id: otherModule.id, ...ALL_FLAGS });
  return role;
};

const createLogin = async (employer, accessLevel, { role = null } = {}) => {
  const person = await db.User.create({ name: "Sara Khan", email: uniqueEmail(accessLevel.toLowerCase()), password: passwordHash });
  await db.HrmsAccount.create({
    user_id: person.id,
    employer_id: employer.id,
    access_level: accessLevel,
    role_id: role ? role.id : null,
    password_setup_required: false,
  });
  return person;
};

const loginAs = async (email) => {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken;
};

// flags undefined → no role at all.
const loginFor = async (employer, accessLevel, flags) => {
  const role = flags ? await createRole(employer, flags) : null;
  const person = await createLogin(employer, accessLevel, { role });
  return { person, token: await loginAs(person.email) };
};

const ownerCompany = async () => {
  const company = await createCompany();
  return { ...company, token: await loginAs(company.owner.email) };
};

const createEmployee = async (employer, overrides = {}) => {
  const user = await db.User.create({ name: "Emp Person", email: uniqueEmail("emp"), password: passwordHash });
  return db.Employee.create({
    user_id: user.id,
    employer_id: employer.id,
    employee_code: `E-${short()}`,
    country_emp_id: short(),
    full_name: "Ahmed Ali",
    employment_status: "ACTIVE",
    ...overrides,
  });
};

const createDept = (employer, overrides = {}) =>
  db.Department.create({
    employer_id: employer.id,
    name: `Dept ${short()}`,
    code: `C${short()}`.toUpperCase(),
    ...overrides,
  });

const createDesignation = (employer, department, overrides = {}) =>
  db.Designation.create({ employer_id: employer.id, department_id: department.id, name: `Desig ${short()}`, ...overrides });

const setCreatedAt = (designation, iso) =>
  db.sequelize.query("UPDATE hrms_designations SET created_at = ? WHERE id = ?", { replacements: [new Date(iso), designation.id] });

const withAuth = (req, token, lang) => {
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req;
};
const listDesigs = (token, deptId, query = {}, lang) =>
  withAuth(request(app).get(`/api/departments/${deptId}/designations`).query(query), token, lang);
const dropdown = (token, query = {}, lang) => withAuth(request(app).get("/api/designations").query(query), token, lang);
const createDesigApi = (token, deptId, body, lang) =>
  withAuth(request(app).post(`/api/departments/${deptId}/designations`), token, lang).send(body);
const updateDesigApi = (token, id, body, lang) => withAuth(request(app).put(`/api/designations/${id}`), token, lang).send(body);
const deleteDesigApi = (token, id, lang) => withAuth(request(app).delete(`/api/designations/${id}`), token, lang);

const findDesigRaw = (id) => db.Designation.findByPk(id, { paranoid: false, raw: true });

const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);
const MISSING_ID = "7d0f6c2e-1111-4a5b-9c3d-000000000000";

// ---------- GET /api/departments/:id/designations ----------

describe("GET /api/departments/:id/designations", () => {
  it("returns an empty page for a department with no designations", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await listDesigs(token, dept.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { items: [], total: 0, page: 1, limit: 20 } });
  });

  it("returns each row with its count of non-deleted employees of any status", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept, { name: "Site Engineer", code: "SE", description: "On site" });
    await createEmployee(employer, { department_id: dept.id, designation_id: desig.id });
    await createEmployee(employer, { department_id: dept.id, designation_id: desig.id, employment_status: "EXITED" });
    const deletedEmp = await createEmployee(employer, { department_id: dept.id, designation_id: desig.id });
    await deletedEmp.destroy();

    const res = await listDesigs(token, dept.id);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([
      {
        id: desig.id,
        department_id: dept.id,
        name: "Site Engineer",
        code: "SE",
        description: "On site",
        status: "ACTIVE",
        employee_count: 2,
        created_at: ISO,
        updated_at: ISO,
      },
    ]);
  });

  it("returns null code and description when not set and zero employees", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    await createDesignation(employer, dept);

    const res = await listDesigs(token, dept.id);

    expect(res.body.data.items[0]).toMatchObject({ code: null, description: null, employee_count: 0 });
  });

  it("lists the newest designation first (the UI adds new ones at the top)", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const oldest = await createDesignation(employer, dept, { name: "Alpha" });
    const newest = await createDesignation(employer, dept, { name: "Beta" });
    const middle = await createDesignation(employer, dept, { name: "Gamma" });
    await setCreatedAt(oldest, "2025-01-01T00:00:00Z");
    await setCreatedAt(middle, "2025-06-01T00:00:00Z");
    await setCreatedAt(newest, "2026-01-01T00:00:00Z");

    const res = await listDesigs(token, dept.id);

    expect(res.body.data.items.map((item) => item.name)).toEqual(["Beta", "Gamma", "Alpha"]);
  });

  it("paginates with page and limit", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const rows = [];
    for (let i = 0; i < 5; i += 1) {
      const desig = await createDesignation(employer, dept, { name: `Desig ${i}` });
      await setCreatedAt(desig, `2025-01-0${i + 1}T00:00:00Z`);
      rows.push(desig);
    }

    const res = await listDesigs(token, dept.id, { page: 2, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 5, page: 2, limit: 2 });
    expect(res.body.data.items.map((item) => item.name)).toEqual(["Desig 2", "Desig 1"]);
  });

  it("searches name or code, case-insensitively", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    await createDesignation(employer, dept, { name: "Site Engineer", code: "SE" });
    await createDesignation(employer, dept, { name: "Accountant", code: "ACC-ENG" });
    await createDesignation(employer, dept, { name: "Driver", code: "DRV" });

    const res = await listDesigs(token, dept.id, { search: "eng" });

    expect(res.body.data.total).toBe(2);
    expect(res.body.data.items.map((item) => item.name).sort()).toEqual(["Accountant", "Site Engineer"]);
  });

  it("treats % and _ in the search as plain characters", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    await createDesignation(employer, dept, { name: "Plain" });
    await createDesignation(employer, dept, { name: "Ratio 50%" });

    expect((await listDesigs(token, dept.id, { search: "%" })).body.data.items.map((i) => i.name)).toEqual(["Ratio 50%"]);
    expect((await listDesigs(token, dept.id, { search: "_" })).body.data.total).toBe(0);
  });

  it("filters by status; an empty status means all", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    await createDesignation(employer, dept, { name: "On", status: "ACTIVE" });
    await createDesignation(employer, dept, { name: "Off", status: "INACTIVE" });

    const active = await listDesigs(token, dept.id, { status: "ACTIVE" });
    const inactive = await listDesigs(token, dept.id, { status: "INACTIVE" });
    const all = await listDesigs(token, dept.id, { status: "" });

    expect(active.body.data.items.map((item) => item.name)).toEqual(["On"]);
    expect(inactive.body.data.items.map((item) => item.name)).toEqual(["Off"]);
    expect(all.body.data.total).toBe(2);
  });

  it("lists only this department's live designations", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const otherDept = await createDept(employer);
    const mine = await createDesignation(employer, dept);
    const deleted = await createDesignation(employer, dept);
    await deleted.destroy();
    await createDesignation(employer, otherDept);

    const res = await listDesigs(token, dept.id);

    expect(res.body.data.items.map((item) => item.id)).toEqual([mine.id]);
    expect(res.body.data.total).toBe(1);
  });

  it("lists the designations of an inactive department", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer, { status: "INACTIVE" });
    await createDesignation(employer, dept);

    const res = await listDesigs(token, dept.id);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });

  it("accepts limit 100 and page 1", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await listDesigs(token, dept.id, { page: 1, limit: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, limit: 100 });
  });

  it.each([
    ["page", { page: 0 }],
    ["page", { page: "abc" }],
    ["page", { page: 1.5 }],
    ["limit", { limit: 0 }],
    ["limit", { limit: 101 }],
    ["status", { status: "DELETED" }],
    ["status", { status: "active" }],
  ])("rejects an invalid %s (%o)", async (field, query) => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await listDesigs(token, dept.id, query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ [field]: "VALIDATION_FAILED" }));
  });

  it("returns 404 for another company's department", async () => {
    const { token } = await ownerCompany();
    const { employer: other } = await createCompany();
    const theirs = await createDept(other);
    await createDesignation(other, theirs);

    const res = await listDesigs(token, theirs.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it.each([
    ["a deleted department", "deleted"],
    ["a missing department", "missing"],
    ["a malformed id", "malformed"],
  ])("returns 404 for %s", async (label, kind) => {
    const { employer, token } = await ownerCompany();
    let id = kind === "missing" ? MISSING_ID : "not-a-uuid";
    if (kind === "deleted") {
      const dept = await createDept(employer);
      await dept.destroy();
      id = dept.id;
    }

    const res = await listDesigs(token, id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it("answers 404 in Arabic", async () => {
    const { token } = await ownerCompany();

    const res = await listDesigs(token, MISSING_ID, {}, "ar");

    expect(res.body).toEqual(errorBody("NOT_FOUND", "ar"));
  });
});

// ---------- GET /api/designations (dropdown) ----------

describe("GET /api/designations", () => {
  it("returns only active designations of active, live departments of this company, ordered by name", async () => {
    const { employer, token } = await ownerCompany();
    const { employer: other } = await createCompany();
    const active = await createDept(employer);
    const inactive = await createDept(employer, { status: "INACTIVE" });
    const deletedDept = await createDept(employer);
    const zeta = await createDesignation(employer, active, { name: "Zeta", code: "ZT" });
    const alpha = await createDesignation(employer, active, { name: "alpha" });
    await createDesignation(employer, active, { name: "Off", status: "INACTIVE" });
    const gone = await createDesignation(employer, active, { name: "Gone" });
    await gone.destroy();
    await createDesignation(employer, inactive, { name: "In inactive dept" });
    await createDesignation(employer, deletedDept, { name: "In deleted dept" });
    await deletedDept.destroy();
    const theirs = await createDept(other);
    await createDesignation(other, theirs, { name: "Theirs" });

    const res = await dropdown(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        items: [
          { id: alpha.id, name: "alpha", code: null, department_id: active.id },
          { id: zeta.id, name: "Zeta", code: "ZT", department_id: active.id },
        ],
      },
    });
  });

  it("filters by departmentId", async () => {
    const { employer, token } = await ownerCompany();
    const deptA = await createDept(employer);
    const deptB = await createDept(employer);
    const inA = await createDesignation(employer, deptA, { name: "In A" });
    await createDesignation(employer, deptB, { name: "In B" });

    const res = await dropdown(token, { departmentId: deptA.id });

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((item) => item.id)).toEqual([inA.id]);
  });

  it("returns nothing for an inactive department or another company's department", async () => {
    const { employer, token } = await ownerCompany();
    const { employer: other } = await createCompany();
    const inactive = await createDept(employer, { status: "INACTIVE" });
    await createDesignation(employer, inactive);
    const theirs = await createDept(other);
    await createDesignation(other, theirs);

    expect((await dropdown(token, { departmentId: inactive.id })).body.data.items).toEqual([]);
    expect((await dropdown(token, { departmentId: theirs.id })).body.data.items).toEqual([]);
  });

  it("treats an empty departmentId as no filter", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    await createDesignation(employer, dept);

    const res = await dropdown(token, { departmentId: "" });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it("rejects a departmentId that is not a uuid", async () => {
    const { token } = await ownerCompany();

    const res = await dropdown(token, { departmentId: "abc" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ departmentId: "VALIDATION_FAILED" }));
  });
});

// ---------- POST /api/departments/:id/designations ----------

describe("POST /api/departments/:id/designations", () => {
  it("creates a designation: 201, code uppercase, created/updated by the caller", async () => {
    const { employer, owner, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await createDesigApi(token, dept.id, {
      name: "  Site Engineer ",
      code: " se-1 ",
      description: " Works on site ",
      status: "INACTIVE",
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        department_id: dept.id,
        name: "Site Engineer",
        code: "SE-1",
        description: "Works on site",
        status: "INACTIVE",
        employee_count: 0,
        created_at: ISO,
        updated_at: ISO,
      },
    });
    const row = await findDesigRaw(res.body.data.id);
    expect(row).toMatchObject({ employer_id: employer.id, department_id: dept.id, created_by: owner.id, updated_by: owner.id });
  });

  it("creates with only a name; code and description empty → null; status defaults to ACTIVE", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await createDesigApi(token, dept.id, { name: "Driver", code: "", description: "" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Driver", code: null, description: null, status: "ACTIVE" });
  });

  it("accepts null code and description", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await createDesigApi(token, dept.id, { name: "Driver", code: null, description: null });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: null, description: null });
  });

  it("creates under an inactive department", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer, { status: "INACTIVE" });

    const res = await createDesigApi(token, dept.id, { name: "Driver" });

    expect(res.status).toBe(201);
  });

  it("records a sub-admin as created_by and updated_by", async () => {
    const { employer } = await createCompany();
    const dept = await createDept(employer);
    const { person, token } = await loginFor(employer, "SUB_ADMIN", { can_create: true });

    const res = await createDesigApi(token, dept.id, { name: "Driver" });

    expect(res.status).toBe(201);
    expect(await findDesigRaw(res.body.data.id)).toMatchObject({ created_by: person.id, updated_by: person.id });
  });

  it("ignores employer and department ids in the body", async () => {
    const { employer, token } = await ownerCompany();
    const { employer: other } = await createCompany();
    const dept = await createDept(employer);
    const otherDept = await createDept(employer);

    const res = await createDesigApi(token, dept.id, {
      name: "Driver",
      employer_id: other.id,
      department_id: otherDept.id,
      departmentId: otherDept.id,
    });

    expect(res.status).toBe(201);
    expect(await findDesigRaw(res.body.data.id)).toMatchObject({ employer_id: employer.id, department_id: dept.id });
  });

  it("stores Arabic names, codes and descriptions", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await createDesigApi(token, dept.id, { name: "مهندس موقع", code: "مهم", description: "يعمل في الموقع" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "مهندس موقع", code: "مهم", description: "يعمل في الموقع" });
  });

  describe("name", () => {
    it.each([
      ["missing", {}, "designationNameRequired"],
      ["empty", { name: "" }, "designationNameRequired"],
      ["blank", { name: "   " }, "designationNameRequired"],
      ["null", { name: null }, "designationNameRequired"],
      ["not a string", { name: 12 }, "designationNameRequired"],
      ["1 character", { name: "A" }, "designationNameMin"],
      ["1 character after trimming", { name: "  A  " }, "designationNameMin"],
      ["151 characters", { name: "A".repeat(151) }, "designationNameMax"],
      ["an emoji", { name: "Engineer 🚀" }, "designationNameNoEmoji"],
      ["a pictograph", { name: "Engineer ✈" }, "designationNameNoEmoji"],
    ])("rejects a name that is %s", async (label, body, key) => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);

      const res = await createDesigApi(token, dept.id, body);

      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ name: key }));
    });

    it("accepts a 2-character and a 150-character name", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);

      expect((await createDesigApi(token, dept.id, { name: "AB" })).status).toBe(201);
      const long = await createDesigApi(token, dept.id, { name: "B".repeat(150) });
      expect(long.status).toBe(201);
      expect(long.body.data.name).toHaveLength(150);
    });
  });

  describe("code", () => {
    it.each([
      ["51 characters", { code: "C".repeat(51) }, "designationCodeMax"],
      ["an emoji", { code: "SE🔥" }, "designationCodeNoEmoji"],
    ])("rejects a code that is %s", async (label, body, key) => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);

      const res = await createDesigApi(token, dept.id, { name: "Driver", ...body });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ code: key }));
    });

    it("rejects a code that is not a string", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);

      const res = await createDesigApi(token, dept.id, { name: "Driver", code: 12 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ code: "VALIDATION_FAILED" }));
    });

    it("accepts a 50-character code and stores it uppercase", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);

      const res = await createDesigApi(token, dept.id, { name: "Driver", code: "c".repeat(50) });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe("C".repeat(50));
    });

    it("stores a blank code as null", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);

      const res = await createDesigApi(token, dept.id, { name: "Driver", code: "   " });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBeNull();
    });
  });

  describe("description", () => {
    it.each([
      ["2001 characters", { description: "D".repeat(2001) }, "descriptionMax"],
      ["an emoji", { description: "Nice 😀" }, "descriptionNoEmoji"],
    ])("rejects a description that is %s", async (label, body, key) => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);

      const res = await createDesigApi(token, dept.id, { name: "Driver", ...body });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ description: key }));
    });

    it("accepts a 2000-character description", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);

      const res = await createDesigApi(token, dept.id, { name: "Driver", description: "D".repeat(2000) });

      expect(res.status).toBe(201);
    });
  });

  it("rejects an unknown status", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await createDesigApi(token, dept.id, { name: "Driver", status: "DELETED" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ status: "VALIDATION_FAILED" }));
  });

  it("reports every bad field at once", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await createDesigApi(token, dept.id, { name: "A", code: "C".repeat(51), description: "🙂" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      validationBody({ name: "designationNameMin", code: "designationCodeMax", description: "descriptionNoEmoji" })
    );
  });

  it("answers field errors in Arabic", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await createDesigApi(token, dept.id, { name: "", code: "🚀" }, "ar");

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ name: "designationNameRequired", code: "designationCodeNoEmoji" }, "ar"));
  });

  it.each([
    ["another company's department", "other"],
    ["a deleted department", "deleted"],
    ["a malformed id", "malformed"],
  ])("returns 404 for %s and creates nothing", async (label, kind) => {
    const { employer, token } = await ownerCompany();
    const { employer: other } = await createCompany();
    let id = "not-a-uuid";
    if (kind === "other") id = (await createDept(other)).id;
    if (kind === "deleted") {
      const dept = await createDept(employer);
      await dept.destroy();
      id = dept.id;
    }

    const res = await createDesigApi(token, id, { name: "Driver" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
    expect(await db.Designation.count({ where: { employer_id: [employer.id, other.id] }, paranoid: false })).toBe(0);
  });

  describe("duplicates", () => {
    it('allows "Engineer" in two departments of one company', async () => {
      const { employer, token } = await ownerCompany();
      const deptA = await createDept(employer);
      const deptB = await createDept(employer);

      expect((await createDesigApi(token, deptA.id, { name: "Engineer" })).status).toBe(201);
      expect((await createDesigApi(token, deptB.id, { name: "Engineer" })).status).toBe(201);
    });

    it('rejects "engineer" twice in one department → 409 DESIGNATION_NAME_TAKEN', async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);
      await createDesignation(employer, dept, { name: "Engineer" });

      const res = await createDesigApi(token, dept.id, { name: "  engineer " });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("DESIGNATION_NAME_TAKEN"));
      expect(res.body.message).toBe("A designation with this name already exists in this department.");
    });

    it("rejects the same code in another department of the company → 409 DESIGNATION_CODE_TAKEN", async () => {
      const { employer, token } = await ownerCompany();
      const deptA = await createDept(employer);
      const deptB = await createDept(employer);
      await createDesignation(employer, deptA, { code: "ENG" });

      const res = await createDesigApi(token, deptB.id, { name: "Engineer", code: "eng" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("DESIGNATION_CODE_TAKEN"));
      expect(res.body.message).toBe("A designation with this code already exists.");
    });

    it("allows many designations with no code", async () => {
      const { employer, token } = await ownerCompany();
      const deptA = await createDept(employer);
      const deptB = await createDept(employer);

      expect((await createDesigApi(token, deptA.id, { name: "One" })).status).toBe(201);
      expect((await createDesigApi(token, deptA.id, { name: "Two", code: "" })).status).toBe(201);
      expect((await createDesigApi(token, deptB.id, { name: "Three", code: null })).status).toBe(201);
    });

    it("does not clash with a department's code", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer, { code: "ENG" });

      expect((await createDesigApi(token, dept.id, { name: "Engineer", code: "ENG" })).status).toBe(201);
    });

    it("reports the name first when both name and code are taken", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);
      await createDesignation(employer, dept, { name: "Engineer", code: "ENG" });

      const res = await createDesigApi(token, dept.id, { name: "Engineer", code: "ENG" });

      expect(res.body).toEqual(errorBody("DESIGNATION_NAME_TAKEN"));
    });

    it("allows the same name and code in another company", async () => {
      const { employer, token } = await ownerCompany();
      const { employer: other } = await createCompany();
      const theirs = await createDept(other);
      await createDesignation(other, theirs, { name: "Engineer", code: "ENG" });
      const myDept = await createDept(employer);

      const res = await createDesigApi(token, myDept.id, { name: "Engineer", code: "ENG" });

      expect(res.status).toBe(201);
    });

    it("maps a unique-key clash that slips past the pre-check to the same codes", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);
      await createDesignation(employer, dept, { name: "Engineer", code: "ENG" });
      // Simulate a concurrent save: the pre-check sees nothing.
      jest.spyOn(db.Designation, "findOne").mockResolvedValue(null);

      const nameClash = await createDesigApi(token, dept.id, { name: "Engineer" });
      const otherDept = await createDept(employer);
      const codeClash = await createDesigApi(token, otherDept.id, { name: "Other", code: "ENG" });

      expect(nameClash.status).toBe(409);
      expect(nameClash.body).toEqual(errorBody("DESIGNATION_NAME_TAKEN"));
      expect(codeClash.status).toBe(409);
      expect(codeClash.body).toEqual(errorBody("DESIGNATION_CODE_TAKEN"));
    });

    it("answers a duplicate in Arabic", async () => {
      const { employer, token } = await ownerCompany();
      const dept = await createDept(employer);
      await createDesignation(employer, dept, { name: "Engineer" });

      const res = await createDesigApi(token, dept.id, { name: "Engineer" }, "ar");

      expect(res.body).toEqual(errorBody("DESIGNATION_NAME_TAKEN", "ar"));
    });
  });
});

// ---------- PUT /api/designations/:id ----------

describe("PUT /api/designations/:id", () => {
  it("updates every field; updated_by is the caller, created_by stays", async () => {
    const { employer, owner } = await createCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept, { name: "Old", code: "OLD", description: "Old desc", created_by: owner.id });
    const { person, token } = await loginFor(employer, "SUB_ADMIN", { can_update: true });

    const res = await updateDesigApi(token, desig.id, { name: " New ", code: "new", description: "New desc", status: "INACTIVE" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: desig.id,
        department_id: dept.id,
        name: "New",
        code: "NEW",
        description: "New desc",
        status: "INACTIVE",
        employee_count: 0,
        created_at: ISO,
        updated_at: ISO,
      },
    });
    expect(await findDesigRaw(desig.id)).toMatchObject({ created_by: owner.id, updated_by: person.id });
  });

  it("keeps omitted optional fields; null or empty clears code and description", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept, { code: "KEEP", description: "Keep me", status: "INACTIVE" });

    const kept = await updateDesigApi(token, desig.id, { name: "Renamed" });
    expect(kept.body.data).toMatchObject({ name: "Renamed", code: "KEEP", description: "Keep me", status: "INACTIVE" });

    const cleared = await updateDesigApi(token, desig.id, { name: "Renamed", code: "", description: null });
    expect(cleared.body.data).toMatchObject({ code: null, description: null, status: "INACTIVE" });

    const setAgain = await updateDesigApi(token, desig.id, { name: "Renamed", code: "x1" });
    expect(setAgain.body.data.code).toBe("X1");
    expect((await updateDesigApi(token, desig.id, { name: "Renamed", code: null })).body.data.code).toBeNull();
  });

  it("can't move a designation to another department (department ids in the body are ignored)", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const otherDept = await createDept(employer);
    const desig = await createDesignation(employer, dept);

    const res = await updateDesigApi(token, desig.id, { name: "Stays", department_id: otherDept.id, departmentId: otherDept.id });

    expect(res.status).toBe(200);
    expect(res.body.data.department_id).toBe(dept.id);
    expect(await findDesigRaw(desig.id)).toMatchObject({ department_id: dept.id, employer_id: employer.id });
  });

  it("allows keeping its own name and code, even in another case", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept, { name: "Engineer", code: "ENG" });

    const res = await updateDesigApi(token, desig.id, { name: "ENGINEER", code: "eng" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "ENGINEER", code: "ENG" });
  });

  it("rejects another designation's name in the same department, and any used code in the company", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const otherDept = await createDept(employer);
    await createDesignation(employer, dept, { name: "Taken" });
    await createDesignation(employer, otherDept, { name: "Elsewhere", code: "USED" });
    const desig = await createDesignation(employer, dept, { name: "Mine" });

    const nameRes = await updateDesigApi(token, desig.id, { name: "taken" });
    const codeRes = await updateDesigApi(token, desig.id, { name: "Mine", code: "used" });
    const okRes = await updateDesigApi(token, desig.id, { name: "Elsewhere" });

    expect(nameRes.status).toBe(409);
    expect(nameRes.body).toEqual(errorBody("DESIGNATION_NAME_TAKEN"));
    expect(codeRes.status).toBe(409);
    expect(codeRes.body).toEqual(errorBody("DESIGNATION_CODE_TAKEN"));
    expect(okRes.status).toBe(200);
  });

  it("checks a kept code against the company when only the name changes", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept, { name: "Mine", code: "MINE" });

    const res = await updateDesigApi(token, desig.id, { name: "Mine Renamed" });

    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe("MINE");
  });

  it("validates the body like create", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept);

    const res = await updateDesigApi(token, desig.id, { name: "🚀🚀", code: "C".repeat(51), description: "D".repeat(2001), status: "x" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      validationBody({
        name: "designationNameNoEmoji",
        code: "designationCodeMax",
        description: "descriptionMax",
        status: "VALIDATION_FAILED",
      })
    );
  });

  it("requires a name", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept);

    const res = await updateDesigApi(token, desig.id, { code: "X" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ name: "designationNameRequired" }));
  });

  it.each([
    ["another company's designation", "other"],
    ["a deleted designation", "deleted"],
    ["a missing designation", "missing"],
    ["a malformed id", "malformed"],
  ])("returns 404 for %s and leaves it unchanged", async (label, kind) => {
    const { employer, token } = await ownerCompany();
    const { employer: other } = await createCompany();
    let target = null;
    let id = kind === "missing" ? MISSING_ID : "not-a-uuid";
    if (kind === "other") target = await createDesignation(other, await createDept(other), { name: "Theirs" });
    if (kind === "deleted") {
      target = await createDesignation(employer, await createDept(employer), { name: "Gone" });
      await target.destroy();
    }
    if (target) id = target.id;
    const before = target ? await findDesigRaw(target.id) : null;

    const res = await updateDesigApi(token, id, { name: "Hijack" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
    if (target) expect(await findDesigRaw(target.id)).toEqual(before);
  });
});

// ---------- DELETE /api/designations/:id ----------

describe("DELETE /api/designations/:id", () => {
  it("soft-deletes an unused designation", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept);

    const res = await deleteDesigApi(token, desig.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: desig.id } });
    const row = await findDesigRaw(desig.id);
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect((await listDesigs(token, dept.id)).body.data.total).toBe(0);
  });

  it.each(["ACTIVE", "EXITED"])("is blocked by a linked %s employee → 409 DESIGNATION_IN_USE", async (status) => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept);
    await createEmployee(employer, { department_id: dept.id, designation_id: desig.id, employment_status: status });

    const res = await deleteDesigApi(token, desig.id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("DESIGNATION_IN_USE"));
    expect(res.body.message).toBe("This designation has employees and can't be deleted.");
    expect((await findDesigRaw(desig.id)).deletedAt).toBeNull();
  });

  it("is not blocked by a deleted employee or by employees of other designations", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept);
    const sibling = await createDesignation(employer, dept);
    const gone = await createEmployee(employer, { department_id: dept.id, designation_id: desig.id });
    await gone.destroy();
    await createEmployee(employer, { department_id: dept.id, designation_id: sibling.id });

    const res = await deleteDesigApi(token, desig.id);

    expect(res.status).toBe(200);
  });

  it("answers DESIGNATION_IN_USE in Arabic", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept);
    await createEmployee(employer, { designation_id: desig.id });

    const res = await deleteDesigApi(token, desig.id, "ar");

    expect(res.body).toEqual(errorBody("DESIGNATION_IN_USE", "ar"));
  });

  it("lets the name and code be used again after delete", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const otherDept = await createDept(employer);
    const desig = await createDesignation(employer, dept, { name: "Engineer", code: "ENG" });

    await deleteDesigApi(token, desig.id);

    expect((await createDesigApi(token, dept.id, { name: "engineer" })).status).toBe(201);
    expect((await createDesigApi(token, otherDept.id, { name: "Other", code: "eng" })).status).toBe(201);
  });

  it.each([
    ["another company's designation", "other"],
    ["a missing designation", "missing"],
    ["a malformed id", "malformed"],
  ])("returns 404 for %s", async (label, kind) => {
    const { token } = await ownerCompany();
    const { employer: other } = await createCompany();
    let target = null;
    let id = kind === "missing" ? MISSING_ID : "not-a-uuid";
    if (kind === "other") {
      target = await createDesignation(other, await createDept(other));
      id = target.id;
    }

    const res = await deleteDesigApi(token, id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
    if (target) expect((await findDesigRaw(target.id)).deletedAt).toBeNull();
  });

  it("returns 404 when deleting twice", async () => {
    const { employer, token } = await ownerCompany();
    const desig = await createDesignation(employer, await createDept(employer));

    await deleteDesigApi(token, desig.id);
    const res = await deleteDesigApi(token, desig.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });
});

// ---------- access ----------

// Each route with the role flag it needs and a call that succeeds for an allowed caller.
const ROUTES = [
  {
    label: "GET /api/departments/:id/designations",
    flag: "can_read",
    status: 200,
    call: (token, { dept }) => listDesigs(token, dept.id),
  },
  { label: "GET /api/designations", flag: "can_read", status: 200, call: (token) => dropdown(token) },
  {
    label: "POST /api/departments/:id/designations",
    flag: "can_create",
    status: 201,
    call: (token, { dept }) => createDesigApi(token, dept.id, { name: `New ${short()}` }),
  },
  {
    label: "PUT /api/designations/:id",
    flag: "can_update",
    status: 200,
    call: (token, { desig }) => updateDesigApi(token, desig.id, { name: `Upd ${short()}` }),
  },
  { label: "DELETE /api/designations/:id", flag: "can_delete", status: 200, call: (token, { desig }) => deleteDesigApi(token, desig.id) },
];

const otherFlagsOnly = (flag) => ({ ...ALL_FLAGS, [flag]: false });

describe.each(ROUTES)("access: $label", ({ flag, status, call }) => {
  const setup = async () => {
    const { employer, owner } = await createCompany();
    const dept = await createDept(employer);
    const desig = await createDesignation(employer, dept);
    return { employer, owner, dept, desig };
  };

  it("allows the owner (ADMIN) without any role", async () => {
    const ctx = await setup();
    const token = await loginAs(ctx.owner.email);

    expect((await call(token, ctx)).status).toBe(status);
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE"])("allows a %s whose role has the flag", async (level) => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, level, { [flag]: true });

    expect((await call(token, ctx)).status).toBe(status);
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE"])(
    "forbids a %s whose role has every other flag (and every department flag) but this one",
    async (level) => {
      const ctx = await setup();
      const { token } = await loginFor(ctx.employer, level, otherFlagsOnly(flag));

      const res = await call(token, ctx);

      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
      expect(res.body.message).toBe("You don't have permission to do this.");
    }
  );

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])("forbids a %s with no role", async (level) => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, level);

    const res = await call(token, ctx);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("forbids a STAFFING_COMPANY login even with every designation flag (plan §2)", async () => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, "STAFFING_COMPANY", ALL_FLAGS);

    const res = await call(token, ctx);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("answers 403 in Arabic", async () => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", NO_FLAGS);

    const res = await call(token, ctx).set("Accept-Language", "ar");

    expect(res.body).toEqual(errorBody("FORBIDDEN", "ar"));
  });

  it("returns 401 AUTH_REQUIRED without a token", async () => {
    const ctx = await setup();

    const res = await call(undefined, ctx);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("returns 401 AUTH_REQUIRED for an invalid token", async () => {
    const ctx = await setup();

    const res = await call("garbage.token.value", ctx);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("does not touch the data when forbidden", async () => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", NO_FLAGS);
    const before = await findDesigRaw(ctx.desig.id);

    await call(token, ctx);

    expect(await findDesigRaw(ctx.desig.id)).toEqual(before);
    expect(await db.Designation.count({ where: { employer_id: ctx.employer.id } })).toBe(1);
  });
});
