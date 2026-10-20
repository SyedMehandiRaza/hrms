const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const { seedId } = require("../src/utils/seed");
const { build } = require("./helpers/factory");
const requireAuth = require("../src/middlewares/requireAuth");
const requirePermission = require("../src/middlewares/requirePermission");
const requireAccessLevel = require("../src/middlewares/requireAccessLevel");
const language = require("../src/middlewares/language");
const errorHandler = require("../src/middlewares/errorHandler");
const cookieParser = require("cookie-parser");
const authService = require("../src/services/auth.service");
const { createAuthRouter } = require("../src/routes/auth.routes");
const { authRateLimiter } = require("../src/middlewares/rateLimit");
const { getRateLimitConfig } = require("../src/config/rateLimit");
const { MESSAGES } = require("../src/constants/messages");

const PASSWORD = "Test@12345";
const COOKIE = "refresh_token";
const ALL_FALSE = { read: false, create: false, update: false, delete: false };
const ALL_TRUE = { read: true, create: true, update: true, delete: true };

const errorBody = (code) => ({ success: false, code, message: MESSAGES[code].en });

let passwordHash;
const modules = {};

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  for (const [key, name] of [
    ["department", "Departments"],
    ["designation", "Designations"],
    ["employee", "Employees"],
  ]) {
    const [row] = await db.Module.findOrCreate({ where: { module_key: key }, defaults: { name } });
    modules[key] = row;
  }
});

beforeEach(() => {
  // Failed logins are logged with console.warn; keep the test output quiet.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  await db.sequelize.close();
});

// ---------- helpers ----------

const uniqueEmail = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}@hrms.test`;

const createCompany = async ({ status = "ACTIVE", name = "Al Noor Construction", timezone = "Asia/Riyadh" } = {}) => {
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: passwordHash });
  const employer = await build(db, "Employer", {
    user_id: owner.id,
    company_name: name,
    company_logo: "/uploads/logos/logo.png",
    employer_status: status,
  });
  await db.CompanyTimeSetting.create({ employer_id: employer.id, timezone });
  const ownerAccount = await db.HrmsAccount.create({
    user_id: owner.id,
    employer_id: employer.id,
    access_level: "ADMIN",
    password_setup_required: false,
  });
  return { employer, owner, ownerAccount };
};

const createRole = async (employer, flags) => {
  const role = await db.Role.create({ employer_id: employer.id, name: `Role ${crypto.randomUUID().slice(0, 6)}` });
  for (const [key, f] of Object.entries(flags)) {
    await db.RolePermission.create({
      role_id: role.id,
      module_id: modules[key].id,
      can_read: !!f.read,
      can_create: !!f.create,
      can_update: !!f.update,
      can_delete: !!f.delete,
    });
  }
  return role;
};

const createLogin = async (employer, { accessLevel, role = null, user = {}, account = {} }) => {
  const person = await db.User.create({
    name: "Sara Khan",
    email: uniqueEmail(accessLevel.toLowerCase()),
    password: passwordHash,
    ...user,
  });
  const acc = await db.HrmsAccount.create({
    user_id: person.id,
    employer_id: employer.id,
    access_level: accessLevel,
    role_id: role ? role.id : null,
    password_setup_required: false,
    ...account,
  });
  return { user: person, account: acc };
};

const login = (email, password = PASSWORD) => request(app).post("/api/auth/login").send({ email, password });

const setCookieOf = (res) => (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));

// "refresh_token=abc; Path=..." → "refresh_token=abc"
const cookiePair = (res) => {
  const header = setCookieOf(res);
  return header ? header.split(";")[0] : undefined;
};

const refresh = (cookie) => {
  const req = request(app).post("/api/auth/refresh");
  return cookie ? req.set("Cookie", cookie) : req;
};

const me = (token) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

const loginOk = async (email) => {
  const res = await login(email);
  expect(res.status).toBe(200);
  return { token: res.body.data.accessToken, cookie: cookiePair(res), res };
};

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Small app with guarded routes, for the permission middlewares.
const guardApp = express();
guardApp.use(language);
guardApp.get("/departments", requireAuth, requirePermission("department", "create"), (req, res) =>
  res.json({ success: true, data: req.auth })
);
guardApp.get("/owner-only", requireAuth, requireAccessLevel("ADMIN"), (req, res) => res.json({ success: true, data: {} }));
guardApp.use(errorHandler);

const guarded = (path, token) => request(guardApp).get(path).set("Authorization", `Bearer ${token}`);

// ---------- POST /auth/login ----------

describe("POST /api/auth/login", () => {
  let company;
  beforeAll(async () => {
    company = await createCompany();
  });

  it("logs the owner in: access token in the body and a strict httpOnly refresh cookie", async () => {
    const res = await login(company.owner.email);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(res.body.data.mustChangePassword).toBe(false);

    const payload = jwt.verify(res.body.data.accessToken, process.env.JWT_ACCESS_SECRET);
    expect(payload).toMatchObject({ sub: company.owner.id, acc: company.ownerAccount.id, emp: company.employer.id });
    expect(typeof payload.sid).toBe("string");
    expect(payload.exp - payload.iat).toBe(15 * 60);

    const cookie = setCookieOf(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth(;|$)/);
    expect(cookie).toMatch(/Max-Age=604800/);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("stores a session with hashed tokens (never the raw refresh token)", async () => {
    const res = await login(company.owner.email);
    const { sid } = jwt.decode(res.body.data.accessToken);
    const raw = cookiePair(res).split("=")[1];

    const session = await db.HrmsSession.findByPk(sid);
    expect(session.status).toBe("ACTIVE");
    expect(session.hrms_account_id).toBe(company.ownerAccount.id);
    expect(session.refresh_token_hash).toBe(sha256(decodeURIComponent(raw)));
    expect(session.refresh_token_hash).not.toBe(raw);
    expect(session.access_token_hash).toHaveLength(64);
    expect(session.last_used_at).not.toBeNull();
    const days = (new Date(session.expires_at) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it("records the last-login time", async () => {
    const { user, account } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN" });
    await account.reload();
    expect(account.last_login_at).toBeNull();
    await loginOk(user.email);
    await account.reload();
    expect(account.last_login_at).not.toBeNull();
    expect(Date.now() - new Date(account.last_login_at)).toBeLessThan(60000);
  });

  it("accepts the email in any case and with surrounding spaces", async () => {
    const res = await login(`  ${company.owner.email.toUpperCase()} `);
    expect(res.status).toBe(200);
  });

  it("returns mustChangePassword from password_setup_required", async () => {
    const { user } = await createLogin(company.employer, { accessLevel: "EMPLOYEE", account: { password_setup_required: true } });
    const res = await login(user.email);
    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  describe("wrong credentials", () => {
    it("answers a wrong password and an unknown email with the identical 401 body", async () => {
      const wrongPassword = await login(company.owner.email, "Wrong@12345");
      const unknownEmail = await login(uniqueEmail("nobody"), PASSWORD);

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(wrongPassword.body.message).toBe("Invalid email or password.");
      expect(setCookieOf(wrongPassword)).toBeUndefined();
      expect(setCookieOf(unknownEmail)).toBeUndefined();
    });

    it("still runs a bcrypt comparison for an unknown email (no timing shortcut)", async () => {
      const compare = jest.spyOn(bcrypt, "compare");
      await login(uniqueEmail("ghost"), PASSWORD);
      expect(compare).toHaveBeenCalledTimes(1);
    });

    it("rejects a person without a password set as invalid credentials", async () => {
      const { user } = await createLogin(company.employer, { accessLevel: "EMPLOYEE", user: { password: null } });
      const res = await login(user.email);
      expect(res.status).toBe(401);
      expect(res.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));
    });

    it("writes failed logins to the server log with email, IP and reason, never the password", async () => {
      const warn = console.warn;
      await login(company.owner.email, "Sup3r$ecretWrong");
      await login("Ghost.Person@hrms.test", "Other$ecret99");

      const logged = JSON.stringify(warn.mock.calls);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(logged).toContain(company.owner.email);
      expect(logged).toContain("ghost.person@hrms.test");
      expect(logged).toMatch(/ip/i);
      expect(logged).toMatch(/reason/i);
      expect(logged).not.toContain("Sup3r$ecretWrong");
      expect(logged).not.toContain("Other$ecret99");
    });

    it("answers in Arabic when asked", async () => {
      const res = await login(company.owner.email, "nope").set("Accept-Language", "ar");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        code: "AUTH_INVALID_CREDENTIALS",
        message: MESSAGES.AUTH_INVALID_CREDENTIALS.ar,
      });
    });
  });

  describe("validation", () => {
    it("requires email and password", async () => {
      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ...errorBody("VALIDATION_FAILED"),
        errors: { email: "Email is required", password: "Password is required" },
      });
    });

    it("treats empty strings as missing", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "", password: "" });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual({ email: "Email is required", password: "Password is required" });
    });

    it("rejects an invalid email address", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "x" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ ...errorBody("VALIDATION_FAILED"), errors: { email: "Invalid email address" } });
    });

    it("does not check the password format at login", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: company.owner.email, password: "x" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_INVALID_CREDENTIALS");
    });
  });

  describe("inactive person or account", () => {
    it("refuses an inactive person with 403 AUTH_ACCOUNT_INACTIVE", async () => {
      const { user } = await createLogin(company.employer, { accessLevel: "EMPLOYEE", user: { user_status: "INACTIVE" } });
      const res = await login(user.email);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
      expect(res.body.message).toBe("Your account is inactive. Contact your administrator.");
      expect(setCookieOf(res)).toBeUndefined();
    });

    it("checks credentials before the person's status", async () => {
      const { user } = await createLogin(company.employer, { accessLevel: "EMPLOYEE", user: { user_status: "INACTIVE" } });
      const res = await login(user.email, "Wrong@12345");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_INVALID_CREDENTIALS");
    });

    it("refuses a person whose only account has ended (INACTIVE)", async () => {
      const { user } = await createLogin(company.employer, { accessLevel: "EMPLOYEE", account: { status: "INACTIVE" } });
      const res = await login(user.email);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });

    it("refuses a person whose only account was deleted", async () => {
      const { user, account } = await createLogin(company.employer, { accessLevel: "EMPLOYEE" });
      await account.destroy();
      const res = await login(user.email);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });

    it("refuses a suspended account", async () => {
      const { user } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN", account: { status: "SUSPENDED" } });
      const res = await login(user.email);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });

    it("logs a person with an ended account elsewhere into their current company", async () => {
      const other = await createCompany({ name: "Old Co" });
      const { user } = await createLogin(other.employer, { accessLevel: "EMPLOYEE", account: { status: "INACTIVE" } });
      const current = await db.HrmsAccount.create({
        user_id: user.id,
        employer_id: company.employer.id,
        access_level: "GENERAL_EMPLOYEE",
        password_setup_required: false,
      });

      const { token } = await loginOk(user.email);
      expect(jwt.decode(token)).toMatchObject({ acc: current.id, emp: company.employer.id });
    });
  });

  describe("company status", () => {
    it.each(["INACTIVE", "BANNED"])("refuses a %s company with 403 AUTH_COMPANY_INACTIVE", async (status) => {
      const blocked = await createCompany({ status });
      const res = await login(blocked.owner.email);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_COMPANY_INACTIVE"));
      expect(res.body.message).toBe("Your company's access is disabled. Contact support.");
      expect(setCookieOf(res)).toBeUndefined();
    });

    it("checks the account before the company", async () => {
      const blocked = await createCompany({ status: "BANNED" });
      const { user } = await createLogin(blocked.employer, { accessLevel: "EMPLOYEE", account: { status: "SUSPENDED" } });
      const res = await login(user.email);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("AUTH_ACCOUNT_INACTIVE");
    });
  });
});

// ---------- GET /auth/me (each access level) ----------

describe("GET /api/auth/me", () => {
  let company;
  beforeAll(async () => {
    company = await createCompany({ name: "Al Noor Construction", timezone: "Asia/Riyadh" });
  });

  it("returns the owner's profile, company, admin panel and every permission", async () => {
    const { token } = await loginOk(company.owner.email);
    const res = await me(token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.user).toEqual({ id: company.owner.id, name: "Owner Person", email: company.owner.email, lang_key: "EN" });
    expect(data.account).toEqual({ id: company.ownerAccount.id, access_level: "ADMIN", panel: "admin" });
    expect(data.company).toEqual({
      id: company.employer.id,
      name: "Al Noor Construction",
      logo: "/uploads/logos/logo.png",
      timezone: "Asia/Riyadh",
      currency: "SAR",
      // countries-cities-phones D11: every company is in Saudi Arabia for now.
      country: { id: seedId("country:SA"), iso2: "SA", name: "Saudi Arabia", callingCode: "+966" },
    });
    expect(data.mustChangePassword).toBe(false);

    const allModules = await db.Module.findAll();
    expect(Object.keys(data.permissions).sort()).toEqual(allModules.map((m) => m.module_key).sort());
    Object.values(data.permissions).forEach((flags) => expect(flags).toEqual(ALL_TRUE));
    expect(JSON.stringify(data)).not.toMatch(/password"|\$2[aby]\$/);
  });

  it("gives a SUB_ADMIN the admin panel and only the role's flags", async () => {
    const role = await createRole(company.employer, { department: { read: true, create: true } });
    const { user, account } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN", role });
    const { token } = await loginOk(user.email);
    const res = await me(token);

    expect(res.status).toBe(200);
    expect(res.body.data.account).toEqual({ id: account.id, access_level: "SUB_ADMIN", panel: "admin" });
    expect(res.body.data.permissions.department).toEqual({ read: true, create: true, update: false, delete: false });
    expect(res.body.data.permissions.designation).toEqual(ALL_FALSE);
    expect(res.body.data.permissions.employee).toEqual(ALL_FALSE);
  });

  it.each([
    ["GENERAL_EMPLOYEE", "employee"],
    ["EMPLOYEE", "employee"],
  ])("gives a %s the %s panel and only the role's flags", async (accessLevel, panel) => {
    const role = await createRole(company.employer, { employee: { read: true }, department: { read: true } });
    const { user } = await createLogin(company.employer, { accessLevel, role });
    const { token } = await loginOk(user.email);
    const res = await me(token);

    expect(res.status).toBe(200);
    expect(res.body.data.account.panel).toBe(panel);
    expect(res.body.data.permissions.employee).toEqual({ read: true, create: false, update: false, delete: false });
    expect(res.body.data.permissions.department).toEqual({ read: true, create: false, update: false, delete: false });
    expect(res.body.data.permissions.designation).toEqual(ALL_FALSE);
  });

  it("gives a STAFFING_COMPANY login the staffing-company panel and all flags false without a role", async () => {
    const { user } = await createLogin(company.employer, { accessLevel: "STAFFING_COMPANY" });
    const { token } = await loginOk(user.email);
    const res = await me(token);

    expect(res.status).toBe(200);
    expect(res.body.data.account.panel).toBe("staffing-company");
    const allModules = await db.Module.findAll();
    expect(Object.keys(res.body.data.permissions)).toHaveLength(allModules.length);
    Object.values(res.body.data.permissions).forEach((flags) => expect(flags).toEqual(ALL_FALSE));
  });

  it("ignores a role of another company", async () => {
    const other = await createCompany({ name: "Other Co" });
    const foreignRole = await createRole(other.employer, { department: ALL_TRUE });
    const { user } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN", role: foreignRole });
    const { token } = await loginOk(user.email);
    const res = await me(token);
    expect(res.body.data.permissions.department).toEqual(ALL_FALSE);
  });

  it("returns 401 AUTH_REQUIRED without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });
});

// ---------- requireAuth ----------

describe("requireAuth", () => {
  let company;
  beforeAll(async () => {
    company = await createCompany();
  });

  it("rejects a missing token with 401 AUTH_REQUIRED", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
    expect(res.body.message).toBe("Please log in to continue.");
  });

  it("rejects a garbage token with 401 AUTH_REQUIRED", async () => {
    const res = await me("garbage.token.value");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("rejects a token signed with another secret with 401 AUTH_REQUIRED", async () => {
    const forged = jwt.sign({ sub: company.owner.id, acc: "x", emp: "y", sid: "z" }, "not-the-secret");
    const res = await me(forged);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("rejects an expired access token with 401 AUTH_TOKEN_EXPIRED", async () => {
    const { token } = await loginOk(company.owner.email);
    const claims = jwt.decode(token);
    const expired = jwt.sign(
      { sub: claims.sub, acc: claims.acc, emp: claims.emp, sid: claims.sid, exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_ACCESS_SECRET
    );
    const res = await me(expired);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_TOKEN_EXPIRED"));
    expect(res.body.message).toBe("Your session has expired. Please log in again.");
  });

  it("rejects a token whose session was revoked with 401 AUTH_REQUIRED", async () => {
    const { token } = await loginOk(company.owner.email);
    await db.HrmsSession.update({ status: "REVOKED", revoked_at: new Date() }, { where: { id: jwt.decode(token).sid } });
    const res = await me(token);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("rejects a token whose claims don't match its session (tampered company)", async () => {
    const other = await createCompany({ name: "Other Co" });
    const { token } = await loginOk(company.owner.email);
    const claims = jwt.decode(token);
    const tampered = jwt.sign(
      { sub: claims.sub, acc: claims.acc, emp: other.employer.id, sid: claims.sid },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "5m" }
    );
    const res = await me(tampered);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("sets req.auth with ids, access level, role and permissions", async () => {
    const role = await createRole(company.employer, { department: { read: true, create: true } });
    const { user, account } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN", role });
    const { token } = await loginOk(user.email);

    const res = await guarded("/departments", token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      userId: user.id,
      accountId: account.id,
      employerId: company.employer.id,
      sessionId: jwt.decode(token).sid,
      accessLevel: "SUB_ADMIN",
      roleId: role.id,
    });
    expect(res.body.data.permissions.department).toEqual({ read: true, create: true, update: false, delete: false });
  });

  describe("an already-issued token after a status change", () => {
    it.each(["INACTIVE", "BANNED"])("gets 403 AUTH_COMPANY_INACTIVE once the company is %s", async (status) => {
      const co = await createCompany();
      const { token } = await loginOk(co.owner.email);
      expect((await me(token)).status).toBe(200);

      await co.employer.update({ employer_status: status });
      const res = await me(token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_COMPANY_INACTIVE"));
    });

    it.each(["INACTIVE", "SUSPENDED"])("gets 403 AUTH_ACCOUNT_INACTIVE once the account is %s", async (status) => {
      const { user, account } = await createLogin(company.employer, { accessLevel: "EMPLOYEE" });
      const { token } = await loginOk(user.email);
      expect((await me(token)).status).toBe(200);

      await account.update({ status });
      const res = await me(token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });

    it("gets 403 AUTH_ACCOUNT_INACTIVE once the account is deleted", async () => {
      const { user, account } = await createLogin(company.employer, { accessLevel: "EMPLOYEE" });
      const { token } = await loginOk(user.email);
      await account.destroy();
      const res = await me(token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });

    it("gets 403 AUTH_ACCOUNT_INACTIVE once the person is inactive", async () => {
      const { user } = await createLogin(company.employer, { accessLevel: "EMPLOYEE" });
      const { token } = await loginOk(user.email);
      await user.update({ user_status: "INACTIVE" });
      const res = await me(token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });
  });
});

// ---------- requirePermission / requireAccessLevel ----------

describe("requirePermission", () => {
  let company;
  beforeAll(async () => {
    company = await createCompany();
  });

  it("lets the owner through without any role", async () => {
    const { token } = await loginOk(company.owner.email);
    const res = await guarded("/departments", token);
    expect(res.status).toBe(200);
  });

  it("lets a role with the flag through", async () => {
    const role = await createRole(company.employer, { department: { create: true } });
    const { user } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN", role });
    const { token } = await loginOk(user.email);
    expect((await guarded("/departments", token)).status).toBe(200);
  });

  it("refuses a role without the flag with 403 FORBIDDEN", async () => {
    const role = await createRole(company.employer, { department: { read: true, update: true, delete: true } });
    const { user } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN", role });
    const { token } = await loginOk(user.email);
    const res = await guarded("/departments", token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    expect(res.body.message).toBe("You don't have permission to do this.");
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])(
    "refuses a %s account with no role with 403 FORBIDDEN",
    async (accessLevel) => {
      const { user } = await createLogin(company.employer, { accessLevel });
      const { token } = await loginOk(user.email);
      const res = await guarded("/departments", token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    }
  );

  it("applies a role flag change on the next request without logging in again", async () => {
    const role = await createRole(company.employer, { department: { read: true } });
    const { user } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN", role });
    const { token } = await loginOk(user.email);
    expect((await guarded("/departments", token)).status).toBe(403);

    await db.RolePermission.update({ can_create: true }, { where: { role_id: role.id, module_id: modules.department.id } });
    expect((await guarded("/departments", token)).status).toBe(200);
    expect((await me(token)).body.data.permissions.department.create).toBe(true);

    await db.RolePermission.update({ can_create: false }, { where: { role_id: role.id, module_id: modules.department.id } });
    expect((await guarded("/departments", token)).status).toBe(403);
  });

  it("refuses an unknown action when the route is defined", () => {
    expect(() => requirePermission("department", "approve")).toThrow(/action/);
  });

  it("returns 401 before 403 when there is no token", async () => {
    const res = await request(guardApp).get("/departments");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });
});

describe("requireAccessLevel", () => {
  let company;
  beforeAll(async () => {
    company = await createCompany();
  });

  it("allows an allowed access level", async () => {
    const { token } = await loginOk(company.owner.email);
    expect((await guarded("/owner-only", token)).status).toBe(200);
  });

  it("refuses other access levels with 403 FORBIDDEN, whatever their role allows", async () => {
    const role = await createRole(company.employer, { department: ALL_TRUE, designation: ALL_TRUE, employee: ALL_TRUE });
    const { user } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN", role });
    const { token } = await loginOk(user.email);
    const res = await guarded("/owner-only", token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });
});

// ---------- POST /auth/refresh ----------

describe("POST /api/auth/refresh", () => {
  let company;
  beforeAll(async () => {
    company = await createCompany();
  });

  it("issues a new access token and a new cookie; the old cookie stops working", async () => {
    const { user, account } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN" });
    const first = await loginOk(user.email);

    const res = await refresh(first.cookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const newToken = res.body.data.accessToken;
    expect(typeof newToken).toBe("string");
    expect(newToken).not.toBe(first.token);

    const newCookie = cookiePair(res);
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(first.cookie);
    const header = setCookieOf(res);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Strict/i);
    expect(header).toMatch(/Path=\/api\/auth(;|$)/);
    expect(header).toMatch(/Max-Age=604800/);

    const oldSid = jwt.decode(first.token).sid;
    const newClaims = jwt.decode(newToken);
    expect(newClaims).toMatchObject({ sub: user.id, acc: account.id, emp: company.employer.id });
    expect(newClaims.sid).not.toBe(oldSid);

    const oldSession = await db.HrmsSession.findByPk(oldSid);
    expect(oldSession.status).toBe("REVOKED");
    expect(oldSession.revoked_at).not.toBeNull();
    const newSession = await db.HrmsSession.findByPk(newClaims.sid);
    expect(newSession.status).toBe("ACTIVE");
    expect(newSession.last_used_at).not.toBeNull();

    // The new token works; the old one's session is gone.
    expect((await me(newToken)).status).toBe(200);
    expect((await me(first.token)).status).toBe(401);

    // The new cookie keeps rotating.
    const again = await refresh(newCookie);
    expect(again.status).toBe(200);
  });

  it("slides the expiry: each rotation issues a fresh 7 days", async () => {
    const { user } = await createLogin(company.employer, { accessLevel: "EMPLOYEE" });
    const first = await loginOk(user.email);
    await db.HrmsSession.update(
      { expires_at: new Date(Date.now() + 86400000) },
      { where: { id: jwt.decode(first.token).sid } }
    );
    const res = await refresh(first.cookie);
    expect(res.status).toBe(200);
    const session = await db.HrmsSession.findByPk(jwt.decode(res.body.data.accessToken).sid);
    expect((new Date(session.expires_at) - Date.now()) / 86400000).toBeGreaterThan(6.9);
  });

  it("detects reuse of a rotated cookie: every session of the account ends, 401 AUTH_REFRESH_INVALID", async () => {
    const { user, account } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN" });
    const deviceA = await loginOk(user.email);
    const deviceB = await loginOk(user.email);
    const bystander = await loginOk(company.owner.email);

    const rotated = await refresh(deviceA.cookie);
    expect(rotated.status).toBe(200);
    const rotatedCookie = cookiePair(rotated);

    const reuse = await refresh(deviceA.cookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body).toEqual(errorBody("AUTH_REFRESH_INVALID"));
    expect(reuse.body.message).toBe("Your session has expired. Please log in again.");

    const active = await db.HrmsSession.count({ where: { hrms_account_id: account.id, status: "ACTIVE" } });
    expect(active).toBe(0);
    expect((await refresh(rotatedCookie)).status).toBe(401);
    expect((await refresh(deviceB.cookie)).status).toBe(401);
    expect((await me(rotated.body.data.accessToken)).status).toBe(401);
    expect((await me(deviceB.token)).status).toBe(401);

    // Another account's session is untouched.
    expect((await me(bystander.token)).status).toBe(200);
    expect((await refresh(bystander.cookie)).status).toBe(200);
  });

  it("refuses a missing cookie with 401 AUTH_REFRESH_INVALID", async () => {
    const res = await refresh();
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REFRESH_INVALID"));
  });

  it("refuses an unknown cookie with 401 AUTH_REFRESH_INVALID", async () => {
    const res = await refresh(`${COOKIE}=${crypto.randomBytes(32).toString("base64url")}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REFRESH_INVALID"));
  });

  it("refuses an expired session with 401 AUTH_REFRESH_INVALID", async () => {
    const { user } = await createLogin(company.employer, { accessLevel: "EMPLOYEE" });
    const { token, cookie } = await loginOk(user.email);
    await db.HrmsSession.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id: jwt.decode(token).sid } });
    const res = await refresh(cookie);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REFRESH_INVALID"));
  });

  it("refuses refresh once the company is deactivated with 403 AUTH_COMPANY_INACTIVE", async () => {
    const co = await createCompany();
    const { cookie } = await loginOk(co.owner.email);
    await co.employer.update({ employer_status: "INACTIVE" });
    const res = await refresh(cookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_COMPANY_INACTIVE"));
  });

  it("refuses refresh once the account is suspended with 403 AUTH_ACCOUNT_INACTIVE", async () => {
    const { user, account } = await createLogin(company.employer, { accessLevel: "EMPLOYEE" });
    const { cookie } = await loginOk(user.email);
    await account.update({ status: "SUSPENDED" });
    const res = await refresh(cookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
  });
});

// ---------- POST /auth/logout ----------

describe("POST /api/auth/logout", () => {
  let company;
  beforeAll(async () => {
    company = await createCompany();
  });

  it("ends the current session, clears the cookie, and a refresh afterwards gets 401", async () => {
    const { user } = await createLogin(company.employer, { accessLevel: "SUB_ADMIN" });
    const current = await loginOk(user.email);
    const otherDevice = await loginOk(user.email);

    const res = await request(app).post("/api/auth/logout").set("Cookie", current.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const cleared = setCookieOf(res);
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Path=\/api\/auth(;|$)/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);

    const session = await db.HrmsSession.findByPk(jwt.decode(current.token).sid);
    expect(session.status).toBe("REVOKED");
    expect(session.revoked_at).not.toBeNull();

    const after = await refresh(current.cookie);
    expect(after.status).toBe(401);
    expect(after.body).toEqual(errorBody("AUTH_REFRESH_INVALID"));
    expect((await me(current.token)).status).toBe(401);

    // Logging out one device does not end the others.
    expect((await me(otherDevice.token)).status).toBe(200);
    expect((await refresh(otherDevice.cookie)).status).toBe(200);
  });

  it("returns 200 without a cookie", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it("returns 200 for an unknown or already-used cookie", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `${COOKIE}=${crypto.randomBytes(32).toString("base64url")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

// ---------- tenant scoping ----------

describe("tenant scoping", () => {
  it("binds each login to its own company only", async () => {
    const coA = await createCompany({ name: "Company A" });
    const coB = await createCompany({ name: "Other Co", timezone: "Asia/Dubai" });

    const a = await loginOk(coA.owner.email);
    const b = await loginOk(coB.owner.email);

    const meA = await me(a.token);
    const meB = await me(b.token);
    expect(meA.body.data.company).toMatchObject({ id: coA.employer.id, name: "Company A" });
    expect(meB.body.data.company).toMatchObject({ id: coB.employer.id, name: "Other Co", timezone: "Asia/Dubai" });

    const authB = await guarded("/departments", b.token);
    expect(authB.body.data.employerId).toBe(coB.employer.id);
  });
});

// ---------- lockout (D10) ----------

const WRONG = "Wrong@12345";
const LOCK_MS = 15 * 60 * 1000;

// Fakes only Date, so the DB driver's own timers keep working.
const fakeClock = (start) => {
  jest.useFakeTimers({
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "queueMicrotask",
      "hrtime",
      "performance",
    ],
    now: start,
  });
};

const sessionCountOf = (userId) =>
  db.HrmsSession.count({ include: [{ model: db.HrmsAccount, as: "hrmsAccount", where: { user_id: userId } }] });

describe("login lockout", () => {
  let company;
  beforeAll(async () => {
    company = await createCompany();
  });

  afterEach(() => jest.useRealTimers());

  const newPerson = async (user = {}) => (await createLogin(company.employer, { accessLevel: "EMPLOYEE", user })).user;

  const failTimes = async (email, times) => {
    const responses = [];
    for (let i = 0; i < times; i += 1) responses.push(await login(email, WRONG));
    return responses;
  };

  it("counts each wrong password; four wrong then the right one logs in and resets the counter", async () => {
    const person = await newPerson();
    const failures = await failTimes(person.email, 4);
    failures.forEach((res) => {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));
    });
    await person.reload();
    expect(person.failed_login_attempts).toBe(4);
    expect(person.locked_until).toBeNull();

    const ok = await login(person.email);
    expect(ok.status).toBe(200);
    await person.reload();
    expect(person.failed_login_attempts).toBe(0);
    expect(person.locked_until).toBeNull();
  });

  it("counts only consecutive failures: a success in between starts over", async () => {
    const person = await newPerson();
    await failTimes(person.email, 4);
    expect((await login(person.email)).status).toBe(200);
    const again = await failTimes(person.email, 4);
    again.forEach((res) => expect(res.status).toBe(401));
    await person.reload();
    expect(person.failed_login_attempts).toBe(4);
  });

  it("locks on the fifth wrong password: 423 AUTH_ACCOUNT_LOCKED for 15 minutes", async () => {
    const start = new Date("2026-10-19T08:00:00Z");
    fakeClock(start);
    const person = await newPerson();
    const responses = await failTimes(person.email, 5);

    responses.slice(0, 4).forEach((res) => expect(res.status).toBe(401));
    const fifth = responses[4];
    expect(fifth.status).toBe(423);
    expect(fifth.body).toEqual(errorBody("AUTH_ACCOUNT_LOCKED"));
    expect(fifth.body.message).toBe("Too many failed attempts. Try again in 15 minutes.");
    expect(setCookieOf(fifth)).toBeUndefined();

    await person.reload();
    expect(new Date(person.locked_until).getTime()).toBe(start.getTime() + LOCK_MS);
  });

  it("refuses even the correct password while locked, without extending the lock", async () => {
    const start = new Date("2026-10-19T09:00:00Z");
    fakeClock(start);
    const person = await newPerson();
    await failTimes(person.email, 5);

    jest.setSystemTime(new Date(start.getTime() + 5 * 60 * 1000));
    const right = await login(person.email);
    expect(right.status).toBe(423);
    expect(right.body).toEqual(errorBody("AUTH_ACCOUNT_LOCKED"));
    expect(setCookieOf(right)).toBeUndefined();

    const wrong = await login(person.email, WRONG);
    expect(wrong.status).toBe(423);
    expect(wrong.body).toEqual(errorBody("AUTH_ACCOUNT_LOCKED"));

    jest.setSystemTime(new Date(start.getTime() + LOCK_MS - 1000));
    expect((await login(person.email)).status).toBe(423);

    await person.reload();
    expect(new Date(person.locked_until).getTime()).toBe(start.getTime() + LOCK_MS);
    expect(await sessionCountOf(person.id)).toBe(0);
  });

  it("logs in with the correct password once the 15 minutes have passed, and clears the lock", async () => {
    const start = new Date("2026-10-19T10:00:00Z");
    fakeClock(start);
    const person = await newPerson();
    await failTimes(person.email, 5);

    jest.setSystemTime(new Date(start.getTime() + LOCK_MS + 1000));
    const res = await login(person.email);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));

    await person.reload();
    expect(person.failed_login_attempts).toBe(0);
    expect(person.locked_until).toBeNull();
  });

  it("starts counting from one again when a wrong password comes after the lock has passed", async () => {
    const start = new Date("2026-10-19T11:00:00Z");
    fakeClock(start);
    const person = await newPerson();
    await failTimes(person.email, 5);

    jest.setSystemTime(new Date(start.getTime() + LOCK_MS + 1000));
    const res = await login(person.email, WRONG);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));
    await person.reload();
    expect(person.failed_login_attempts).toBe(1);
    expect(person.locked_until).toBeNull();
  });

  it("never locks an email that doesn't exist", async () => {
    const email = uniqueEmail("nobody");
    const responses = await failTimes(email, 7);
    responses.forEach((res) => {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));
    });
  });

  it("checks the lock before the person's status (credentials → lock → status)", async () => {
    const person = await newPerson({
      user_status: "INACTIVE",
      locked_until: new Date(Date.now() + LOCK_MS),
      failed_login_attempts: 5,
    });
    const res = await login(person.email);
    expect(res.status).toBe(423);
    expect(res.body.code).toBe("AUTH_ACCOUNT_LOCKED");
  });

  it("answers the locked message in Arabic when asked", async () => {
    const person = await newPerson({ locked_until: new Date(Date.now() + LOCK_MS), failed_login_attempts: 5 });
    const res = await login(person.email).set("Accept-Language", "ar");
    expect(res.status).toBe(423);
    expect(res.body).toEqual({ success: false, code: "AUTH_ACCOUNT_LOCKED", message: MESSAGES.AUTH_ACCOUNT_LOCKED.ar });
  });

  it("logs refused logins on a locked account with the reason, never the password", async () => {
    const person = await newPerson({ locked_until: new Date(Date.now() + LOCK_MS), failed_login_attempts: 5 });
    await login(person.email);
    const logged = JSON.stringify(console.warn.mock.calls);
    expect(logged).toContain(person.email);
    expect(logged).toContain("AUTH_ACCOUNT_LOCKED");
    expect(logged).not.toContain(PASSWORD);
  });

  it("a successful login is one transaction: if the session can't be created, the counter, last login and sessions stay as they were", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const person = await newPerson();
    await failTimes(person.email, 3);
    const account = await db.HrmsAccount.findOne({ where: { user_id: person.id } });
    const lastLoginBefore = account.last_login_at;

    jest.spyOn(db.HrmsSession, "create").mockRejectedValueOnce(new Error("boom"));
    const res = await login(person.email);
    expect(res.status).toBe(500);
    expect(setCookieOf(res)).toBeUndefined();

    await person.reload();
    expect(person.failed_login_attempts).toBe(3);
    await account.reload();
    expect(account.last_login_at).toEqual(lastLoginBefore);
    expect(await sessionCountOf(person.id)).toBe(0);

    // The next try works and clears the counter.
    expect((await login(person.email)).status).toBe(200);
    await person.reload();
    expect(person.failed_login_attempts).toBe(0);
  });

  describe("reusable helpers (password reset and change password use them)", () => {
    it("registerFailedPassword counts a failure and reports the lock on the fifth", async () => {
      const person = await newPerson();
      for (let i = 1; i <= 4; i += 1) {
        expect(await authService.registerFailedPassword(person)).toEqual({ locked: false });
      }
      expect(await authService.registerFailedPassword(person)).toEqual({ locked: true });
      await person.reload();
      expect(person.failed_login_attempts).toBe(5);
      expect(person.locked_until).not.toBeNull();
      expect(authService.isLocked(person)).toBe(true);
    });

    it("clearLockout removes the counter and the lock", async () => {
      const person = await newPerson({ locked_until: new Date(Date.now() + LOCK_MS), failed_login_attempts: 5 });
      expect(authService.isLocked(person)).toBe(true);
      await authService.clearLockout(person);
      await person.reload();
      expect(person.failed_login_attempts).toBe(0);
      expect(person.locked_until).toBeNull();
      expect(authService.isLocked(person)).toBe(false);
      expect((await login(person.email)).status).toBe(200);
    });
  });
});

// ---------- rate limits (D11) ----------

// The real auth router with explicit limits (the main app uses generous limits under test).
const limitedApp = (limits) => {
  const limited = express();
  limited.use(language);
  limited.use(express.json());
  limited.use(cookieParser());
  limited.use("/api/auth", createAuthRouter(limits));
  limited.use(errorHandler);
  return limited;
};

describe("rate limits", () => {
  const PRODUCTION_LIMITS = { windowMs: 60 * 1000, authMax: 10, refreshMax: 60 };

  it("gives the 11th login within a minute from one IP 429 RATE_LIMITED", async () => {
    const limited = limitedApp(PRODUCTION_LIMITS);
    const email = uniqueEmail("nobody");
    for (let i = 0; i < 10; i += 1) {
      const res = await request(limited).post("/api/auth/login").send({ email, password: WRONG });
      expect(res.status).toBe(401);
    }
    const eleventh = await request(limited).post("/api/auth/login").send({ email, password: WRONG });
    expect(eleventh.status).toBe(429);
    expect(eleventh.body).toEqual(errorBody("RATE_LIMITED"));
    expect(eleventh.body.message).toBe("Too many requests. Please try again in a minute.");
  });

  it("counts requests the validator rejects too", async () => {
    const limited = limitedApp({ ...PRODUCTION_LIMITS, authMax: 2 });
    await request(limited).post("/api/auth/login").send({});
    await request(limited).post("/api/auth/login").send({});
    const res = await request(limited).post("/api/auth/login").send({});
    expect(res.status).toBe(429);
    expect(res.body).toEqual(errorBody("RATE_LIMITED"));
  });

  it("answers the rate-limit message in Arabic when asked", async () => {
    const limited = limitedApp({ ...PRODUCTION_LIMITS, authMax: 1 });
    await request(limited).post("/api/auth/login").send({});
    const res = await request(limited).post("/api/auth/login").set("Accept-Language", "ar").send({});
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ success: false, code: "RATE_LIMITED", message: MESSAGES.RATE_LIMITED.ar });
  });

  it("allows 60 refreshes per minute from one IP, then 429", async () => {
    const limited = limitedApp(PRODUCTION_LIMITS);
    for (let i = 0; i < 60; i += 1) {
      const res = await request(limited).post("/api/auth/refresh");
      expect(res.status).toBe(401);
    }
    const res = await request(limited).post("/api/auth/refresh");
    expect(res.status).toBe(429);
    expect(res.body).toEqual(errorBody("RATE_LIMITED"));
  });

  it("keeps the login and refresh budgets separate", async () => {
    const limited = limitedApp({ ...PRODUCTION_LIMITS, authMax: 1, refreshMax: 1 });
    expect((await request(limited).post("/api/auth/login").send({})).status).toBe(400);
    expect((await request(limited).post("/api/auth/refresh")).status).toBe(401);
    expect((await request(limited).post("/api/auth/login").send({})).status).toBe(429);
    expect((await request(limited).post("/api/auth/refresh")).status).toBe(429);
  });

  it("allows requests again after the window passes", async () => {
    const limited = limitedApp({ windowMs: 300, authMax: 1, refreshMax: 1 });
    expect((await request(limited).post("/api/auth/refresh")).status).toBe(401);
    expect((await request(limited).post("/api/auth/refresh")).status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect((await request(limited).post("/api/auth/refresh")).status).toBe(401);
  });

  it("builds a 10-per-minute limiter the other public auth routes reuse", async () => {
    const probe = express();
    probe.use(language);
    probe.post("/signup", authRateLimiter(PRODUCTION_LIMITS), (req, res) => res.json({ success: true }));
    probe.use(errorHandler);
    for (let i = 0; i < 10; i += 1) expect((await request(probe).post("/signup")).status).toBe(200);
    const res = await request(probe).post("/signup");
    expect(res.status).toBe(429);
    expect(res.body).toEqual(errorBody("RATE_LIMITED"));
  });

  describe("configuration", () => {
    const KEYS = ["NODE_ENV", "RATE_LIMIT_WINDOW_MS", "RATE_LIMIT_AUTH_MAX", "RATE_LIMIT_REFRESH_MAX", "RATE_LIMIT_LOOKUP_MAX"];
    let saved;
    beforeEach(() => {
      saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
      KEYS.forEach((k) => delete process.env[k]);
    });
    afterEach(() => {
      KEYS.forEach((k) => {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      });
    });

    it("defaults to 10 per minute on the auth routes and 60 per minute on refresh and the lookups", () => {
      process.env.NODE_ENV = "production";
      expect(getRateLimitConfig()).toEqual({ windowMs: 60 * 1000, authMax: 10, refreshMax: 60, lookupMax: 60 });
    });

    it("reads the limits from the environment", () => {
      process.env.NODE_ENV = "production";
      process.env.RATE_LIMIT_WINDOW_MS = "1000";
      process.env.RATE_LIMIT_AUTH_MAX = "3";
      process.env.RATE_LIMIT_REFRESH_MAX = "4";
      process.env.RATE_LIMIT_LOOKUP_MAX = "5";
      expect(getRateLimitConfig()).toEqual({ windowMs: 1000, authMax: 3, refreshMax: 4, lookupMax: 5 });
    });

    it("uses generous limits under test so the rest of the suite isn't throttled", () => {
      process.env.NODE_ENV = "test";
      const config = getRateLimitConfig();
      expect(config.authMax).toBeGreaterThanOrEqual(1000);
      expect(config.refreshMax).toBeGreaterThanOrEqual(1000);
      expect(config.lookupMax).toBeGreaterThanOrEqual(1000);
    });
  });
});

// ---------- CORS ----------

describe("CORS", () => {
  it("lets the UI origin call the API with credentials", async () => {
    const origin = process.env.CORS_ORIGIN || "http://localhost:5173";
    const res = await request(app).options("/api/auth/login").set("Origin", origin).set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not allow other origins", async () => {
    const res = await request(app)
      .options("/api/auth/login")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).not.toBe("http://evil.example");
  });
});
