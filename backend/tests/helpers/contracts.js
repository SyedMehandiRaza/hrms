const crypto = require("crypto");
const request = require("supertest");
const bcrypt = require("bcrypt");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../../src/app");
const db = require("../../src/models");
const { MESSAGES, FIELD_MESSAGES } = require("../../src/constants/messages");
const { fill } = require("../../src/utils/i18n");

// Shared setup for the Contract Studio test files: companies, logins with `contract`
// role flags, employees and staffing companies with their accounts, request helpers.

const PASSWORD = "Test@12345";
let passwordHash;
const hash = async () => {
  if (!passwordHash) passwordHash = await bcrypt.hash(PASSWORD, 4);
  return passwordHash;
};

const short = () => crypto.randomUUID().slice(0, 8);
const uniqueEmail = (prefix) => `${prefix}-${short()}@hrms.test`;

const errorBody = (code, lang = "en", params) => ({ success: false, code, message: fill(MESSAGES[code][lang], params) });
const fieldText = (key, lang = "en") => (FIELD_MESSAGES[key] || MESSAGES[key])[lang];
const validationBody = (fields, lang = "en") => ({
  ...errorBody("VALIDATION_FAILED", lang),
  errors: Object.fromEntries(Object.entries(fields).map(([field, key]) => [field, fieldText(key, lang)])),
});

const moduleRow = async (moduleKey) =>
  (await db.Module.findOrCreate({ where: { module_key: moduleKey }, defaults: { name: moduleKey } }))[0];

const createCompany = async (name = "Al Noor Construction") => {
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: await hash() });
  const employer = await db.Employer.create({ user_id: owner.id, company_name: name, employer_status: "ACTIVE" });
  const ownerAccount = await db.HrmsAccount.create({
    user_id: owner.id,
    employer_id: employer.id,
    access_level: "ADMIN",
    password_setup_required: false,
  });
  return { owner, employer, ownerAccount };
};

const NO_FLAGS = { can_read: false, can_create: false, can_update: false, can_delete: false };
const ALL_FLAGS = { can_read: true, can_create: true, can_update: true, can_delete: true };

// flags like { can_read: true }. A full flag set on another module must never count.
const createRole = async (employer, flags) => {
  const role = await db.Role.create({ employer_id: employer.id, name: `Role ${short()}` });
  await db.RolePermission.create({ role_id: role.id, module_id: (await moduleRow("contract")).id, ...NO_FLAGS, ...flags });
  await db.RolePermission.create({ role_id: role.id, module_id: (await moduleRow("department")).id, ...ALL_FLAGS });
  return role;
};

const loginAs = async (email) => {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken;
};

const createLogin = async (employer, accessLevel, { flags, name = "Sara Khan", status = "ACTIVE" } = {}) => {
  const role = flags ? await createRole(employer, flags) : null;
  const user = await db.User.create({ name, email: uniqueEmail(accessLevel.toLowerCase()), password: await hash() });
  const account = await db.HrmsAccount.create({
    user_id: user.id,
    employer_id: employer.id,
    access_level: accessLevel,
    role_id: role ? role.id : null,
    status,
    password_setup_required: false,
  });
  return { user, account };
};

// HR sub-admin with the given contract flags (undefined → no role at all).
const hrLogin = async (employer, flags) => {
  const { user } = await createLogin(employer, "SUB_ADMIN", { flags });
  return { user, token: await loginAs(user.email) };
};

const ownerToken = (company) => loginAs(company.owner.email);

// Employee with its own user and account (EMPLOYEE unless accessLevel says otherwise).
const createEmployee = async (employer, overrides = {}, { accessLevel = "EMPLOYEE", accountStatus = "ACTIVE", account = true } = {}) => {
  const user = await db.User.create({ name: overrides.full_name || "Ahmed Ali", email: uniqueEmail("emp"), password: await hash() });
  if (account) {
    await db.HrmsAccount.create({
      user_id: user.id,
      employer_id: employer.id,
      access_level: accessLevel,
      status: accountStatus,
      password_setup_required: false,
    });
  }
  const employee = await db.Employee.create({
    user_id: user.id,
    employer_id: employer.id,
    employee_code: `E-${short()}`,
    country_emp_id: `ID${short()}`.toUpperCase().slice(0, 10),
    full_name: "Ahmed Ali",
    employment_status: "ACTIVE",
    ...overrides,
  });
  return { user, employee };
};

const createStaffingCompany = async (employer, overrides = {}, { login = true, accountStatus = "ACTIVE" } = {}) => {
  let user = null;
  if (login) {
    user = await db.User.create({ name: "Staffing Login", email: uniqueEmail("staffing"), password: await hash() });
    await db.HrmsAccount.create({
      user_id: user.id,
      employer_id: employer.id,
      access_level: "STAFFING_COMPANY",
      status: accountStatus,
      password_setup_required: false,
    });
  }
  const company = await db.StaffingCompany.create({
    employer_id: employer.id,
    user_id: user ? user.id : null,
    name: `Gulf Manpower ${short()}`,
    code: `SC-${short()}`.toUpperCase(),
    status: "ACTIVE",
    ...overrides,
  });
  return { user, company };
};

const createProject = (employer, overrides = {}) =>
  db.Project.create({ employer_id: employer.id, project_name: `Project ${short()}`, project_code: `P-${short()}`, ...overrides });

const assignProject = (employer, employee, project, overrides = {}) =>
  db.EmployeeProject.create({ employer_id: employer.id, employee_id: employee.id, project_id: project.id, ...overrides });

const withAuth = (req, token, lang) => {
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req;
};
const api = {
  get: (path, token, { query, lang } = {}) => withAuth(request(app).get(`/api${path}`).query(query || {}), token, lang),
  post: (path, token, body, { lang } = {}) => withAuth(request(app).post(`/api${path}`), token, lang).send(body),
  put: (path, token, body, { lang } = {}) => withAuth(request(app).put(`/api${path}`), token, lang).send(body),
  patch: (path, token, body, { lang } = {}) => withAuth(request(app).patch(`/api${path}`), token, lang).send(body),
  delete: (path, token, { lang } = {}) => withAuth(request(app).delete(`/api${path}`), token, lang),
};

module.exports = {
  app,
  db,
  request,
  PASSWORD,
  short,
  uniqueEmail,
  errorBody,
  fieldText,
  validationBody,
  NO_FLAGS,
  ALL_FLAGS,
  createCompany,
  createRole,
  createLogin,
  loginAs,
  hrLogin,
  ownerToken,
  createEmployee,
  createStaffingCompany,
  createProject,
  assignProject,
  withAuth,
  api,
};
