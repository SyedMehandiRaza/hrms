const crypto = require("crypto");
const request = require("supertest");
const bcrypt = require("bcrypt");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");

// Departments API: list, view, create, edit, delete (ticket auth-company#12; D31, D33, D36, D37).

const PASSWORD = "Test@12345";

const errorBody = (code, lang = "en") => ({ success: false, code, message: MESSAGES[code][lang] });
const fieldText = (key, lang = "en") => (FIELD_MESSAGES[key] || MESSAGES[key])[lang];
const validationBody = (fields, lang = "en") => ({
  ...errorBody("VALIDATION_FAILED", lang),
  errors: Object.fromEntries(Object.entries(fields).map(([field, key]) => [field, fieldText(key, lang)])),
});

let passwordHash;
let departmentModule;
let otherModule;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  [departmentModule] = await db.Module.findOrCreate({ where: { module_key: "department" }, defaults: { name: "Departments" } });
  [otherModule] = await db.Module.findOrCreate({ where: { module_key: "designation" }, defaults: { name: "Designations" } });
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
  await db.RolePermission.create({ role_id: role.id, module_id: departmentModule.id, ...NO_FLAGS, ...flags });
  // A flag on another module must not count.
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

const setCreatedAt = (dept, iso) =>
  db.sequelize.query("UPDATE hrms_departments SET created_at = ? WHERE id = ?", { replacements: [new Date(iso), dept.id] });

const withAuth = (req, token, lang) => {
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req;
};
const listDepts = (token, query = {}, lang) => withAuth(request(app).get("/api/departments").query(query), token, lang);
const getDept = (token, id, lang) => withAuth(request(app).get(`/api/departments/${id}`), token, lang);
const createDeptApi = (token, body, lang) => withAuth(request(app).post("/api/departments"), token, lang).send(body);
const updateDeptApi = (token, id, body, lang) => withAuth(request(app).put(`/api/departments/${id}`), token, lang).send(body);
const deleteDeptApi = (token, id, lang) => withAuth(request(app).delete(`/api/departments/${id}`), token, lang);

const findDeptRaw = (id) => db.Department.findByPk(id, { paranoid: false, raw: true });

const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);
const OTHER_COMPANY_MISSING_ID = "7d0f6c2e-1111-4a5b-9c3d-000000000000";

// ---------- GET /api/departments ----------

describe("GET /api/departments", () => {
  it("returns an empty page and zero stats for a company with no departments", async () => {
    const { token } = await ownerCompany();

    const res = await listDepts(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { items: [], total: 0, page: 1, limit: 20, stats: { total: 0, active: 0, inactive: 0 } },
    });
  });

  it("returns each row with its head's name and live designation count", async () => {
    const { employer, token } = await ownerCompany();
    const head = await createEmployee(employer, { full_name: "Fatima Noor" });
    const dept = await createDept(employer, { name: "Engineering", code: "ENG", description: "Builds things", dept_head_id: head.id });
    await createDesignation(employer, dept);
    await createDesignation(employer, dept);
    const gone = await createDesignation(employer, dept);
    await gone.destroy();

    const res = await listDepts(token);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([
      {
        id: dept.id,
        name: "Engineering",
        code: "ENG",
        description: "Builds things",
        status: "ACTIVE",
        dept_head_id: head.id,
        head_name: "Fatima Noor",
        designation_count: 2,
        created_at: ISO,
        updated_at: ISO,
      },
    ]);
  });

  it("returns head_name null when there is no head or the head was deleted", async () => {
    const { employer, token } = await ownerCompany();
    const head = await createEmployee(employer);
    const withDeletedHead = await createDept(employer, { dept_head_id: head.id });
    await head.destroy();
    const noHead = await createDept(employer);

    const res = await listDepts(token);

    const byId = Object.fromEntries(res.body.data.items.map((item) => [item.id, item]));
    expect(byId[withDeletedHead.id].head_name).toBeNull();
    expect(byId[noHead.id]).toMatchObject({ dept_head_id: null, head_name: null, designation_count: 0, description: null });
  });

  it("lists the newest department first (the UI adds new ones at the top)", async () => {
    const { employer, token } = await ownerCompany();
    const oldest = await createDept(employer, { name: "Alpha" });
    const newest = await createDept(employer, { name: "Beta" });
    const middle = await createDept(employer, { name: "Gamma" });
    await setCreatedAt(oldest, "2025-01-01T00:00:00Z");
    await setCreatedAt(middle, "2025-06-01T00:00:00Z");
    await setCreatedAt(newest, "2026-01-01T00:00:00Z");

    const res = await listDepts(token);

    expect(res.body.data.items.map((item) => item.name)).toEqual(["Beta", "Gamma", "Alpha"]);
  });

  it("paginates with page and limit", async () => {
    const { employer, token } = await ownerCompany();
    const depts = [];
    for (let i = 0; i < 3; i += 1) depts.push(await createDept(employer, { name: `Dept ${i}` }));
    await setCreatedAt(depts[0], "2026-01-03T00:00:00Z");
    await setCreatedAt(depts[1], "2026-01-02T00:00:00Z");
    await setCreatedAt(depts[2], "2026-01-01T00:00:00Z");

    const page1 = await listDepts(token, { page: 1, limit: 2 });
    const page2 = await listDepts(token, { page: 2, limit: 2 });
    const page3 = await listDepts(token, { page: 3, limit: 2 });

    expect(page1.body.data).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(page1.body.data.items.map((item) => item.name)).toEqual(["Dept 0", "Dept 1"]);
    expect(page2.body.data).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(page2.body.data.items.map((item) => item.name)).toEqual(["Dept 2"]);
    expect(page3.body.data.items).toEqual([]);
  });

  it("searches name or code, case-insensitively", async () => {
    const { employer, token } = await ownerCompany();
    await createDept(employer, { name: "Human Resources", code: "HR" });
    await createDept(employer, { name: "Finance", code: "FIN" });
    await createDept(employer, { name: "Engineering", code: "ENG" });

    const byName = await listDepts(token, { search: "human" });
    const byCode = await listDepts(token, { search: "fin" });
    const both = await listDepts(token, { search: "n" });
    const none = await listDepts(token, { search: "zzz" });

    expect(byName.body.data.items.map((item) => item.code)).toEqual(["HR"]);
    expect(byName.body.data.total).toBe(1);
    expect(byCode.body.data.items.map((item) => item.code)).toEqual(["FIN"]);
    expect(both.body.data.total).toBe(3);
    expect(none.body.data).toMatchObject({ items: [], total: 0 });
  });

  it("treats % and _ in the search as plain characters", async () => {
    const { employer, token } = await ownerCompany();
    await createDept(employer, { name: "Sales", code: "SAL" });
    await createDept(employer, { name: "R_D Lab", code: "RND" });

    expect((await listDepts(token, { search: "%" })).body.data.total).toBe(0);
    expect((await listDepts(token, { search: "_" })).body.data.items.map((item) => item.code)).toEqual(["RND"]);
  });

  it("filters by status; an empty status means all", async () => {
    const { employer, token } = await ownerCompany();
    await createDept(employer, { code: "A1", status: "ACTIVE" });
    await createDept(employer, { code: "I1", status: "INACTIVE" });

    const active = await listDepts(token, { status: "ACTIVE" });
    const inactive = await listDepts(token, { status: "INACTIVE" });
    const all = await listDepts(token, { status: "" });

    expect(active.body.data.items.map((item) => item.code)).toEqual(["A1"]);
    expect(inactive.body.data.items.map((item) => item.code)).toEqual(["I1"]);
    expect(all.body.data.total).toBe(2);
  });

  it("returns stats for the whole company, whatever the filters and page", async () => {
    const { employer, token } = await ownerCompany();
    await createDept(employer, { name: "One", status: "ACTIVE" });
    await createDept(employer, { name: "Two", status: "ACTIVE" });
    await createDept(employer, { name: "Three", status: "INACTIVE" });
    const deleted = await createDept(employer, { name: "Gone", status: "INACTIVE" });
    await deleted.destroy();

    const res = await listDepts(token, { status: "INACTIVE", search: "Three", page: 1, limit: 1 });

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.stats).toEqual({ total: 3, active: 2, inactive: 1 });
  });

  it("lists only the caller's company and no deleted departments", async () => {
    const { employer, token } = await ownerCompany();
    const { employer: other } = await createCompany();
    const mine = await createDept(employer);
    const deleted = await createDept(employer);
    await deleted.destroy();
    await createDept(other);

    const res = await listDepts(token);

    expect(res.body.data.items.map((item) => item.id)).toEqual([mine.id]);
    expect(res.body.data.stats.total).toBe(1);
  });

  it("accepts limit 100 and page 1", async () => {
    const { token } = await ownerCompany();

    const res = await listDepts(token, { page: 1, limit: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, limit: 100 });
  });

  it.each([
    ["page", { page: 0 }],
    ["page", { page: -1 }],
    ["page", { page: "abc" }],
    ["page", { page: 1.5 }],
    ["limit", { limit: 0 }],
    ["limit", { limit: 101 }],
    ["limit", { limit: "x" }],
    ["status", { status: "DELETED" }],
    ["status", { status: "active" }],
  ])("rejects an invalid %s (%o)", async (field, query) => {
    const { token } = await ownerCompany();

    const res = await listDepts(token, query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ [field]: "VALIDATION_FAILED" }));
  });
});

// ---------- GET /api/departments/:id ----------

describe("GET /api/departments/:id", () => {
  it("returns the department with total employees of any status, not deleted ones", async () => {
    const { employer, token } = await ownerCompany();
    const head = await createEmployee(employer, { full_name: "Omar Saeed" });
    const dept = await createDept(employer, { name: "Operations", code: "OPS", dept_head_id: head.id });
    const otherDept = await createDept(employer);
    await createDesignation(employer, dept);
    await createEmployee(employer, { department_id: dept.id, employment_status: "ACTIVE" });
    await createEmployee(employer, { department_id: dept.id, employment_status: "IN_NOTICE" });
    await createEmployee(employer, { department_id: dept.id, employment_status: "EXITED" });
    const removed = await createEmployee(employer, { department_id: dept.id });
    await removed.destroy();
    await createEmployee(employer, { department_id: otherDept.id });

    const res = await getDept(token, dept.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: dept.id,
        name: "Operations",
        code: "OPS",
        description: null,
        status: "ACTIVE",
        dept_head_id: head.id,
        head_name: "Omar Saeed",
        designation_count: 1,
        total_employees: 3,
        created_at: ISO,
        updated_at: ISO,
      },
    });
  });

  it("returns 404 for another company's department", async () => {
    const { token } = await ownerCompany();
    const { employer: other } = await createCompany();
    const theirs = await createDept(other);

    const res = await getDept(token, theirs.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it.each([
    ["an unknown id", OTHER_COMPANY_MISSING_ID],
    ["a malformed id", "not-a-uuid"],
  ])("returns 404 for %s", async (_label, id) => {
    const { token } = await ownerCompany();

    const res = await getDept(token, id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it("returns 404 for a deleted department", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    await dept.destroy();

    const res = await getDept(token, dept.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it("answers 404 in Arabic", async () => {
    const { token } = await ownerCompany();

    const res = await getDept(token, OTHER_COMPANY_MISSING_ID, "ar");

    expect(res.body).toEqual(errorBody("NOT_FOUND", "ar"));
  });
});

// ---------- POST /api/departments ----------

describe("POST /api/departments", () => {
  it("creates a department: 201, code uppercase, created/updated by the caller", async () => {
    const { owner, employer, token } = await ownerCompany();
    const head = await createEmployee(employer, { full_name: "Layla Hassan" });

    const res = await createDeptApi(token, {
      name: "  Quality Assurance  ",
      code: " qa ",
      description: "  Tests releases ",
      deptHeadId: head.id,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        name: "Quality Assurance",
        code: "QA",
        description: "Tests releases",
        status: "ACTIVE",
        dept_head_id: head.id,
        head_name: "Layla Hassan",
        designation_count: 0,
        total_employees: 0,
        created_at: ISO,
        updated_at: ISO,
      },
    });
    const row = await findDeptRaw(res.body.data.id);
    expect(row).toMatchObject({
      employer_id: employer.id,
      name: "Quality Assurance",
      code: "QA",
      created_by: owner.id,
      updated_by: owner.id,
    });
  });

  it("creates with only name and code; description empty → null; status INACTIVE allowed", async () => {
    const { token } = await ownerCompany();

    const minimal = await createDeptApi(token, { name: "Legal", code: "LEG" });
    const inactive = await createDeptApi(token, { name: "Archive", code: "ARC", description: "", deptHeadId: null, status: "INACTIVE" });

    expect(minimal.status).toBe(201);
    expect(minimal.body.data).toMatchObject({ description: null, status: "ACTIVE", dept_head_id: null, head_name: null });
    expect(inactive.status).toBe(201);
    expect(inactive.body.data).toMatchObject({ description: null, status: "INACTIVE", dept_head_id: null });
  });

  it("records a sub-admin as created_by and updated_by", async () => {
    const { employer } = await ownerCompany();
    const { person, token } = await loginFor(employer, "SUB_ADMIN", { can_create: true });

    const res = await createDeptApi(token, { name: "Security", code: "SEC" });

    expect(res.status).toBe(201);
    expect(await findDeptRaw(res.body.data.id)).toMatchObject({ created_by: person.id, updated_by: person.id });
  });

  it("ignores an employer id in the body", async () => {
    const { employer, token } = await ownerCompany();
    const { employer: other } = await createCompany();

    const res = await createDeptApi(token, { name: "Stores", code: "STR", employer_id: other.id, employerId: other.id });

    expect(res.status).toBe(201);
    expect((await findDeptRaw(res.body.data.id)).employer_id).toBe(employer.id);
  });

  it("stores Arabic names and descriptions", async () => {
    const { token } = await ownerCompany();

    const res = await createDeptApi(token, { name: "الموارد البشرية", code: "hr-ar", description: "إدارة شؤون الموظفين" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "الموارد البشرية", code: "HR-AR", description: "إدارة شؤون الموظفين" });
  });

  describe("name", () => {
    it.each([
      ["missing", undefined, "departmentNameRequired"],
      ["empty", "", "departmentNameRequired"],
      ["blank", "   ", "departmentNameRequired"],
      ["null", null, "departmentNameRequired"],
      ["not a string", 123, "departmentNameRequired"],
      ["1 character", "A", "departmentNameMin"],
      ["1 character after trimming", "  A  ", "departmentNameMin"],
      ["151 characters", "a".repeat(151), "departmentNameMax"],
      ["an emoji", "Sales 😀", "departmentNameNoEmoji"],
      ["a pictographic symbol", "Sales ❤", "departmentNameNoEmoji"],
      ["only an emoji", "🚀🚀", "departmentNameNoEmoji"],
    ])("rejects a name that is %s", async (_label, name, key) => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name, code: "X1" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ name: key }));
    });

    it.each([
      ["2 characters", "HR"],
      ["150 characters", "a".repeat(150)],
      ["150 Arabic characters", "ق".repeat(150)],
      ["punctuation and digits", "R&D - Unit #2 (North)"],
    ])("accepts a name of %s", async (_label, name) => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name, code: "OK1" });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(name);
    });
  });

  describe("code", () => {
    it.each([
      ["missing", undefined, "departmentCodeRequired"],
      ["empty", "", "departmentCodeRequired"],
      ["blank", "  ", "departmentCodeRequired"],
      ["null", null, "departmentCodeRequired"],
      ["51 characters", "c".repeat(51), "departmentCodeMax"],
      ["an emoji", "HR😀", "departmentCodeNoEmoji"],
    ])("rejects a code that is %s", async (_label, code, key) => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name: "Valid Name", code });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ code: key }));
    });

    it("accepts a 50-character code and stores it uppercase", async () => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name: "Long Code", code: "c".repeat(50) });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe("C".repeat(50));
    });

    it("accepts a 1-character code", async () => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name: "Short Code", code: "x" });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe("X");
    });
  });

  describe("description", () => {
    it.each([
      ["2001 characters", "d".repeat(2001), "descriptionMax"],
      ["an emoji", "Great team 🎉", "descriptionNoEmoji"],
    ])("rejects a description of %s", async (_label, description, key) => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name: "Valid Name", code: "V1", description });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ description: key }));
    });

    it("accepts a 2000-character description", async () => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name: "Valid Name", code: "V2", description: "d".repeat(2000) });

      expect(res.status).toBe(201);
      expect(res.body.data.description).toHaveLength(2000);
    });

    it("stores a blank description as null", async () => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name: "Valid Name", code: "V3", description: "   " });

      expect(res.status).toBe(201);
      expect(res.body.data.description).toBeNull();
    });
  });

  it("rejects an unknown status", async () => {
    const { token } = await ownerCompany();

    const res = await createDeptApi(token, { name: "Valid Name", code: "S1", status: "ARCHIVED" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ status: "VALIDATION_FAILED" }));
  });

  it("reports every bad field at once", async () => {
    const { token } = await ownerCompany();

    const res = await createDeptApi(token, { name: "", code: "c".repeat(51), description: "😀", deptHeadId: "nope" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      validationBody({
        name: "departmentNameRequired",
        code: "departmentCodeMax",
        description: "descriptionNoEmoji",
        deptHeadId: "departmentHeadInvalid",
      })
    );
  });

  it("answers field errors in Arabic", async () => {
    const { token } = await ownerCompany();

    const res = await createDeptApi(token, { name: "A", code: "", description: "😀" }, "ar");

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      validationBody({ name: "departmentNameMin", code: "departmentCodeRequired", description: "descriptionNoEmoji" }, "ar")
    );
    expect(res.body.errors.name).toBe("يجب ألا يقل اسم القسم عن حرفين");
  });

  describe("department head", () => {
    const rejectsHead = async (token, deptHeadId, lang) => {
      const res = await createDeptApi(token, { name: "Headed", code: `H${short()}`, deptHeadId }, lang);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ deptHeadId: "departmentHeadInvalid" }, lang));
      return res;
    };

    it("rejects another company's employee", async () => {
      const { token } = await ownerCompany();
      const { employer: other } = await createCompany();
      const theirs = await createEmployee(other);

      await rejectsHead(token, theirs.id);
    });

    it.each(["EXITED", "IN_NOTICE"])("rejects an employee who is %s", async (status) => {
      const { employer, token } = await ownerCompany();
      const employee = await createEmployee(employer, { employment_status: status });

      await rejectsHead(token, employee.id);
    });

    it("rejects a deleted employee", async () => {
      const { employer, token } = await ownerCompany();
      const employee = await createEmployee(employer);
      await employee.destroy();

      await rejectsHead(token, employee.id);
    });

    it.each([
      ["an unknown id", OTHER_COMPANY_MISSING_ID],
      ["a malformed id", "abc"],
      ["a number", 42],
    ])("rejects %s", async (_label, id) => {
      const { token } = await ownerCompany();

      await rejectsHead(token, id);
    });

    it("answers the head error in Arabic", async () => {
      const { token } = await ownerCompany();

      const res = await rejectsHead(token, OTHER_COMPANY_MISSING_ID, "ar");

      expect(res.body.errors.deptHeadId).toBe(FIELD_MESSAGES.departmentHeadInvalid.ar);
    });

    it("treats an empty head as no head", async () => {
      const { token } = await ownerCompany();

      const res = await createDeptApi(token, { name: "No Head", code: "NH", deptHeadId: "" });

      expect(res.status).toBe(201);
      expect(res.body.data.dept_head_id).toBeNull();
    });
  });

  describe("duplicates", () => {
    it("rejects the same name in another case → 409 DEPARTMENT_NAME_TAKEN", async () => {
      const { employer, token } = await ownerCompany();
      await createDept(employer, { name: "HR", code: "HR" });

      const res = await createDeptApi(token, { name: "hr", code: "HR2" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("DEPARTMENT_NAME_TAKEN"));
      expect(res.body.message).toBe("A department with this name already exists.");
    });

    it("rejects a used code in another case → 409 DEPARTMENT_CODE_TAKEN", async () => {
      const { employer, token } = await ownerCompany();
      await createDept(employer, { name: "Engineering", code: "ENG" });

      const res = await createDeptApi(token, { name: "Engineering Two", code: "eng" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("DEPARTMENT_CODE_TAKEN"));
      expect(res.body.message).toBe("A department with this code already exists.");
    });

    it("reports the name first when both name and code are taken", async () => {
      const { employer, token } = await ownerCompany();
      await createDept(employer, { name: "Finance", code: "FIN" });

      const res = await createDeptApi(token, { name: "FINANCE", code: "fin" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("DEPARTMENT_NAME_TAKEN"));
    });

    it("allows the same name and code in another company", async () => {
      const { token } = await ownerCompany();
      const { employer: other } = await createCompany();
      await createDept(other, { name: "Logistics", code: "LOG" });

      const res = await createDeptApi(token, { name: "Logistics", code: "LOG" });

      expect(res.status).toBe(201);
    });

    it("answers a duplicate in Arabic", async () => {
      const { employer, token } = await ownerCompany();
      await createDept(employer, { name: "Admin", code: "ADM" });

      const res = await createDeptApi(token, { name: "admin", code: "ADM2" }, "ar");

      expect(res.body).toEqual(errorBody("DEPARTMENT_NAME_TAKEN", "ar"));
    });

    // Two requests at once can both pass the pre-check; the unique key still catches it.
    it.each([
      ["name", { name: "Race Name", code: "RACE1" }, { name: "race name", code: "RACE2" }, "DEPARTMENT_NAME_TAKEN"],
      ["code", { name: "Race One", code: "RACE" }, { name: "Race Two", code: "race" }, "DEPARTMENT_CODE_TAKEN"],
    ])("maps a unique-key clash on %s to its code", async (_label, existing, body, code) => {
      const { employer, token } = await ownerCompany();
      await createDept(employer, existing);
      jest.spyOn(db.Department, "findOne").mockResolvedValue(null);

      const res = await createDeptApi(token, body);

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody(code));
    });
  });
});

// ---------- PUT /api/departments/:id ----------

describe("PUT /api/departments/:id", () => {
  it("updates every field; updated_by is the caller, created_by stays", async () => {
    const { owner, employer } = await ownerCompany();
    const { person, token } = await loginFor(employer, "SUB_ADMIN", { can_update: true });
    const head = await createEmployee(employer, { full_name: "Yusuf Karim" });
    const dept = await createDept(employer, { name: "Old Name", code: "OLD", description: "Old", created_by: owner.id, updated_by: owner.id });

    const res = await updateDeptApi(token, dept.id, {
      name: " New Name ",
      code: "new",
      description: "New description",
      deptHeadId: head.id,
      status: "INACTIVE",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: dept.id,
        name: "New Name",
        code: "NEW",
        description: "New description",
        status: "INACTIVE",
        dept_head_id: head.id,
        head_name: "Yusuf Karim",
        designation_count: 0,
        total_employees: 0,
        created_at: ISO,
        updated_at: ISO,
      },
    });
    expect(await findDeptRaw(dept.id)).toMatchObject({ created_by: owner.id, updated_by: person.id, code: "NEW" });
  });

  it("keeps omitted optional fields; null or empty clears them", async () => {
    const { employer, token } = await ownerCompany();
    const head = await createEmployee(employer);
    const dept = await createDept(employer, { description: "Keep me", dept_head_id: head.id, status: "INACTIVE" });

    const kept = await updateDeptApi(token, dept.id, { name: "Renamed", code: dept.code });
    expect(kept.status).toBe(200);
    expect(kept.body.data).toMatchObject({ name: "Renamed", description: "Keep me", dept_head_id: head.id, status: "INACTIVE" });

    const cleared = await updateDeptApi(token, dept.id, { name: "Renamed", code: dept.code, description: "", deptHeadId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ description: null, dept_head_id: null, head_name: null });
  });

  it("allows keeping its own name and code, even in another case", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer, { name: "Human Resources", code: "HR" });

    const res = await updateDeptApi(token, dept.id, { name: "human resources", code: "hr" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "human resources", code: "HR" });
  });

  it("rejects another department's name or code", async () => {
    const { employer, token } = await ownerCompany();
    await createDept(employer, { name: "Finance", code: "FIN" });
    const dept = await createDept(employer, { name: "Payroll", code: "PAY" });

    const name = await updateDeptApi(token, dept.id, { name: "finance", code: "PAY" });
    const code = await updateDeptApi(token, dept.id, { name: "Payroll", code: "fin" });

    expect(name.status).toBe(409);
    expect(name.body).toEqual(errorBody("DEPARTMENT_NAME_TAKEN"));
    expect(code.status).toBe(409);
    expect(code.body).toEqual(errorBody("DEPARTMENT_CODE_TAKEN"));
  });

  it("validates the body like create", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await updateDeptApi(token, dept.id, { name: "a".repeat(151), code: "😀", description: "d".repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      validationBody({ name: "departmentNameMax", code: "departmentCodeNoEmoji", description: "descriptionMax" })
    );
  });

  it("requires name and code", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    const res = await updateDeptApi(token, dept.id, { description: "Only this" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ name: "departmentNameRequired", code: "departmentCodeRequired" }));
  });

  it("rejects a head who is not an active employee of this company", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const exited = await createEmployee(employer, { employment_status: "EXITED" });

    const res = await updateDeptApi(token, dept.id, { name: dept.name, code: dept.code, deptHeadId: exited.id });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ deptHeadId: "departmentHeadInvalid" }));
  });

  it("returns 404 for another company's department and leaves it unchanged", async () => {
    const { token } = await ownerCompany();
    const { employer: other } = await createCompany();
    const theirs = await createDept(other, { name: "Theirs" });

    const res = await updateDeptApi(token, theirs.id, { name: "Mine Now", code: "MINE" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
    expect((await findDeptRaw(theirs.id)).name).toBe("Theirs");
  });

  it.each([OTHER_COMPANY_MISSING_ID, "123"])("returns 404 for id %s", async (id) => {
    const { token } = await ownerCompany();

    const res = await updateDeptApi(token, id, { name: "Valid", code: "VAL" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });
});

// ---------- DELETE /api/departments/:id ----------

describe("DELETE /api/departments/:id", () => {
  it("deletes an unused department together with its designations", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const d1 = await createDesignation(employer, dept);
    const d2 = await createDesignation(employer, dept);
    const otherDept = await createDept(employer);
    const kept = await createDesignation(employer, otherDept);

    const res = await deleteDeptApi(token, dept.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: dept.id } });
    expect((await findDeptRaw(dept.id)).deleted_at).not.toBeNull();
    for (const designation of [d1, d2]) {
      expect((await db.Designation.findByPk(designation.id, { paranoid: false })).deleted_at).not.toBeNull();
    }
    expect(await db.Designation.findByPk(kept.id)).not.toBeNull();
    expect(await db.Department.findByPk(otherDept.id)).not.toBeNull();
    expect((await getDept(token, dept.id)).status).toBe(404);
  });

  it.each(["ACTIVE", "IN_NOTICE", "EXITED"])("is blocked by a linked %s employee", async (status) => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const designation = await createDesignation(employer, dept);
    await createEmployee(employer, { department_id: dept.id, employment_status: status });

    const res = await deleteDeptApi(token, dept.id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("DEPARTMENT_IN_USE"));
    expect(res.body.message).toBe("This department has employees and can't be deleted.");
    expect(await db.Department.findByPk(dept.id)).not.toBeNull();
    expect(await db.Designation.findByPk(designation.id)).not.toBeNull();
  });

  it("is blocked by an employee linked only through one of its designations", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const designation = await createDesignation(employer, dept);
    await createEmployee(employer, { department_id: null, designation_id: designation.id, employment_status: "EXITED" });

    const res = await deleteDeptApi(token, dept.id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("DEPARTMENT_IN_USE"));
    expect(await db.Department.findByPk(dept.id)).not.toBeNull();
  });

  it("is not blocked by a deleted employee", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    const employee = await createEmployee(employer, { department_id: dept.id });
    await employee.destroy();

    const res = await deleteDeptApi(token, dept.id);

    expect(res.status).toBe(200);
  });

  it("answers DEPARTMENT_IN_USE in Arabic", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);
    await createEmployee(employer, { department_id: dept.id });

    const res = await deleteDeptApi(token, dept.id, "ar");

    expect(res.body).toEqual(errorBody("DEPARTMENT_IN_USE", "ar"));
  });

  it("lets the name and code be used again after delete", async () => {
    const { token } = await ownerCompany();
    const created = await createDeptApi(token, { name: "Marketing", code: "MKT" });
    expect(created.status).toBe(201);

    expect((await deleteDeptApi(token, created.body.data.id)).status).toBe(200);
    const again = await createDeptApi(token, { name: "marketing", code: "mkt" });

    expect(again.status).toBe(201);
    expect(again.body.data).toMatchObject({ name: "marketing", code: "MKT" });
  });

  it("returns 404 for another company's department and leaves it", async () => {
    const { token } = await ownerCompany();
    const { employer: other } = await createCompany();
    const theirs = await createDept(other);

    const res = await deleteDeptApi(token, theirs.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
    expect(await db.Department.findByPk(theirs.id)).not.toBeNull();
  });

  it.each([OTHER_COMPANY_MISSING_ID, "nope"])("returns 404 for id %s", async (id) => {
    const { token } = await ownerCompany();

    const res = await deleteDeptApi(token, id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it("returns 404 when deleting twice", async () => {
    const { employer, token } = await ownerCompany();
    const dept = await createDept(employer);

    await deleteDeptApi(token, dept.id);
    const res = await deleteDeptApi(token, dept.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });
});

// ---------- access ----------

// Each route with the role flag it needs and a call that succeeds for an allowed caller.
const ROUTES = [
  { label: "GET /api/departments", flag: "can_read", status: 200, call: (token) => listDepts(token) },
  { label: "GET /api/departments/:id", flag: "can_read", status: 200, call: (token, { dept }) => getDept(token, dept.id) },
  {
    label: "POST /api/departments",
    flag: "can_create",
    status: 201,
    call: (token) => createDeptApi(token, { name: `New ${short()}`, code: `N${short()}` }),
  },
  {
    label: "PUT /api/departments/:id",
    flag: "can_update",
    status: 200,
    call: (token, { dept }) => updateDeptApi(token, dept.id, { name: `Upd ${short()}`, code: `U${short()}` }),
  },
  { label: "DELETE /api/departments/:id", flag: "can_delete", status: 200, call: (token, { dept }) => deleteDeptApi(token, dept.id) },
];

const otherFlagsOnly = (flag) => ({ ...ALL_FLAGS, [flag]: false });

describe.each(ROUTES)("access: $label", ({ flag, status, call }) => {
  const setup = async () => {
    const { employer, owner } = await createCompany();
    const dept = await createDept(employer);
    return { employer, owner, dept };
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

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE"])("forbids a %s whose role has every other flag but this one", async (level) => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, level, otherFlagsOnly(flag));

    const res = await call(token, ctx);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    expect(res.body.message).toBe("You don't have permission to do this.");
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])("forbids a %s with no role", async (level) => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, level);

    const res = await call(token, ctx);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("forbids a STAFFING_COMPANY login even with every department flag (plan §2)", async () => {
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
    const before = await findDeptRaw(ctx.dept.id);

    await call(token, ctx);

    expect(await findDeptRaw(ctx.dept.id)).toEqual(before);
    expect(await db.Department.count({ where: { employer_id: ctx.employer.id } })).toBe(1);
  });
});
