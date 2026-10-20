const crypto = require("crypto");
const request = require("supertest");
const bcrypt = require("bcrypt");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../../src/app");
const db = require("../../src/models");
const { MESSAGES, FIELD_MESSAGES } = require("../../src/constants/messages");
const { seedId } = require("../../src/utils/seed");

// Shared helpers for API tests: companies, roles, logins per access level, response bodies.

const PASSWORD = "Test@12345";
const SA = seedId("country:SA");
const short = () => crypto.randomUUID().slice(0, 8);
const uniqueEmail = (prefix = "user") => `${prefix}-${short()}@hrms.test`;

let passwordHash;
const hash = async () => {
  if (!passwordHash) passwordHash = await bcrypt.hash(PASSWORD, 4);
  return passwordHash;
};

// Response bodies, as the error middleware builds them.
const errorBody = (code, lang = "en") => ({ success: false, code, message: MESSAGES[code][lang] });
const fieldText = (key, lang = "en") => (FIELD_MESSAGES[key] || MESSAGES[key])[lang];
const validationBody = (fields, lang = "en") => ({
  ...errorBody("VALIDATION_FAILED", lang),
  errors: Object.fromEntries(Object.entries(fields).map(([field, key]) => [field, fieldText(key, lang)])),
});

const moduleRow = async (moduleKey) => (await db.Module.findOrCreate({ where: { module_key: moduleKey }, defaults: { name: moduleKey } }))[0];

// A January–December financial year (yearKey = its calendar year).
const createFinancialYear = (employer, yearKey, overrides = {}) =>
  db.FinancialYear.create({
    employer_id: employer.id,
    year_key: yearKey,
    label: `FY ${yearKey}`,
    start_date: `${yearKey}-01-01`,
    end_date: `${yearKey}-12-31`,
    status: "OPEN",
    ...overrides,
  });

// A company with its owner (ADMIN) account, Riyadh time and the current (OPEN) financial year,
// like sign-up creates.
const createCompany = async ({ name = "Al Noor Construction", timezone = "Asia/Riyadh" } = {}) => {
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: await hash() });
  const employer = await db.Employer.create({ user_id: owner.id, company_name: name, employer_status: "ACTIVE" });
  await db.CompanyTimeSetting.create({ employer_id: employer.id, timezone, fy_start_month: 1 });
  await createFinancialYear(employer, new Date().getUTCFullYear());
  await db.HrmsAccount.create({ user_id: owner.id, employer_id: employer.id, access_level: "ADMIN", password_setup_required: false });
  return { owner, employer };
};

const NO_FLAGS = { can_read: false, can_create: false, can_update: false, can_delete: false };
const ALL_FLAGS = { can_read: true, can_create: true, can_update: true, can_delete: true };

// A role with `flags` on each of `modules` ({ office: { can_read: true } }) — and every flag
// on an unrelated module, which must not count.
const createRole = async (employer, modules) => {
  const role = await db.Role.create({ employer_id: employer.id, name: `Role ${short()}` });
  for (const [key, flags] of Object.entries(modules)) {
    await db.RolePermission.create({ role_id: role.id, module_id: (await moduleRow(key)).id, ...NO_FLAGS, ...flags });
  }
  const other = await moduleRow("notification");
  if (!modules.notification) await db.RolePermission.create({ role_id: role.id, module_id: other.id, ...ALL_FLAGS });
  return role;
};

const loginAs = async (email, password = PASSWORD) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken;
};

// A login of `accessLevel` in the company; `modules` → a role with those flags (undefined → no role).
const createLogin = async (employer, accessLevel, { modules, name = "Sara Khan" } = {}) => {
  const role = modules ? await createRole(employer, modules) : null;
  const person = await db.User.create({ name, email: uniqueEmail(accessLevel.toLowerCase()), password: await hash() });
  const account = await db.HrmsAccount.create({
    user_id: person.id,
    employer_id: employer.id,
    access_level: accessLevel,
    role_id: role ? role.id : null,
    password_setup_required: false,
  });
  return { person, account, role };
};

const loginFor = async (employer, accessLevel, modules) => {
  const login = await createLogin(employer, accessLevel, { modules });
  return { ...login, token: await loginAs(login.person.email) };
};

const ownerCompany = async (options) => {
  const company = await createCompany(options);
  return { ...company, token: await loginAs(company.owner.email) };
};

// An employee row (with its own user) in the company.
const createEmployee = async (employer, overrides = {}) => {
  const user = await db.User.create({ name: overrides.full_name || "Emp Person", email: uniqueEmail("emp"), password: await hash() });
  return db.Employee.create({
    user_id: user.id,
    employer_id: employer.id,
    employee_code: `E-${short()}`,
    country_emp_id: short().toUpperCase(),
    full_name: "Ahmed Ali",
    employment_status: "ACTIVE",
    employment_type: "FULL_TIME",
    ...overrides,
  });
};

// A head office (and optionally its project) for fixtures.
const createOffice = (employer, overrides = {}) =>
  db.Office.create({
    employer_id: employer.id,
    office_name: `Office ${short()}`.replace(/-/g, ""),
    office_email: "office@hrms.test",
    office_phone: "+966112345678",
    phone_country: "SA",
    office_location: "King Fahd Road, Riyadh",
    country_id: SA,
    ...overrides,
  });

const createProject = async (employer, overrides = {}) => {
  const office = overrides.office_id ? null : await createOffice(employer);
  return db.Project.create({
    employer_id: employer.id,
    office_id: office ? office.id : overrides.office_id,
    project_name: `Project ${short()}`,
    project_code: `PRJ-T-${short()}`,
    project_location: "Al Malaz, Riyadh",
    start_date: "2026-01-01",
    end_date: "2027-12-31",
    lat: 24.6877,
    lng: 46.7219,
    radius_meters: 250,
    country_id: SA,
    ...overrides,
  });
};

// Assigns an employee to a project (main or secondary) for fixtures.
const assign = (employee, project, { main = false, start = "2026-01-01" } = {}) =>
  db.EmployeeProject.create({
    employer_id: employee.employer_id,
    employee_id: employee.id,
    project_id: project.id,
    is_active: true,
    start_date: start,
    main_project: main,
    main_project_date_start: main ? start : null,
  });

const withAuth = (req, token, lang) => {
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req;
};
const api = {
  get: (path, token, { query, lang } = {}) => withAuth(request(app).get(path).query(query || {}), token, lang),
  post: (path, token, body, { lang } = {}) => withAuth(request(app).post(path), token, lang).send(body),
  put: (path, token, body, { lang } = {}) => withAuth(request(app).put(path), token, lang).send(body),
  patch: (path, token, body, { lang } = {}) => withAuth(request(app).patch(path), token, lang).send(body),
  delete: (path, token, { lang } = {}) => withAuth(request(app).delete(path), token, lang),
};

const MISSING_ID = "7d0f6c2e-1111-4a5b-9c3d-000000000000";
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);

module.exports = {
  app,
  db,
  PASSWORD,
  SA,
  MISSING_ID,
  ISO,
  short,
  uniqueEmail,
  errorBody,
  fieldText,
  validationBody,
  createCompany,
  createFinancialYear,
  ownerCompany,
  createRole,
  createLogin,
  loginAs,
  loginFor,
  createEmployee,
  createOffice,
  createProject,
  assign,
  withAuth,
  api,
  NO_FLAGS,
  ALL_FLAGS,
};
