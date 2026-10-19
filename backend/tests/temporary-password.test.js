const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const mailer = require("../src/services/mailer");
const { build } = require("./helpers/factory");
const requireAuth = require("../src/middlewares/requireAuth");
const requirePermission = require("../src/middlewares/requirePermission");
const language = require("../src/middlewares/language");
const errorHandler = require("../src/middlewares/errorHandler");
const { createAuthRouter } = require("../src/routes/auth.routes");
const credentials = require("../src/services/credentials.service");
const { PASSWORD_RULE } = require("../src/validations/auth.validation");
const { translate } = require("../src/utils/i18n");
const { MESSAGES } = require("../src/constants/messages");

// Temporary password, setup link and the forced-change gate (ticket auth-company#08,
// D9, D20, D21; ADRs 0002, 0003).

const PASSWORD = "Test@12345";
const NEW_PASSWORD = "Setup#2026x";
const COOKIE = "refresh_token";
const HOUR = 60 * 60 * 1000;
const SETUP_TTL = 72 * HOUR;
const WEAK = MESSAGES.AUTH_PASSWORD_WEAK.en;

const errorBody = (code, lang = "en") => ({ success: false, code, message: MESSAGES[code][lang] });
const validationBody = (errors) => ({ ...errorBody("VALIDATION_FAILED"), errors });

let passwordHash;
const modules = {};

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  for (const [key, name] of [
    ["department", "Departments"],
    ["designation", "Designations"],
  ]) {
    const [row] = await db.Module.findOrCreate({ where: { module_key: key }, defaults: { name } });
    modules[key] = row;
  }
});

beforeEach(() => {
  mailer.clear();
  // Failed logins are logged with console.warn; keep the test output quiet.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await db.sequelize.close();
});

// ---------- helpers ----------

const uniqueEmail = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}@hrms.test`;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

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
const advance = (ms) => jest.setSystemTime(new Date(Date.now() + ms));

const createCompany = async ({ status = "ACTIVE" } = {}) => {
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: passwordHash });
  const employer = await build(db, "Employer", { user_id: owner.id, company_name: "Al Noor Construction", employer_status: status });
  await db.CompanyTimeSetting.create({ employer_id: employer.id, timezone: "Asia/Riyadh" });
  await db.HrmsAccount.create({
    user_id: owner.id,
    employer_id: employer.id,
    access_level: "ADMIN",
    password_setup_required: false,
  });
  return { owner, employer };
};

let company;
const getCompany = async () => {
  company = company || (await createCompany());
  return company;
};

// A role allowing department create, so the guarded test route answers 200 once the
// gate is lifted.
const departmentRole = async (employer) => {
  const role = await db.Role.create({ employer_id: employer.id, name: `Role ${crypto.randomUUID().slice(0, 6)}` });
  await db.RolePermission.create({
    role_id: role.id,
    module_id: modules.department.id,
    can_read: true,
    can_create: true,
    can_update: false,
    can_delete: false,
  });
  return role;
};

// A person newly added by an admin: no password yet, one account in the company with
// the model's defaults (password_setup_required true, no token).
const createNewLogin = async ({ user = {}, account = {}, employer } = {}) => {
  const emp = employer || (await getCompany()).employer;
  const role = await departmentRole(emp);
  const person = await db.User.create({ name: "Omar Saleh", email: uniqueEmail("new"), password: null, ...user });
  const acc = await db.HrmsAccount.create({
    user_id: person.id,
    employer_id: emp.id,
    access_level: "SUB_ADMIN",
    role_id: role.id,
    ...account,
  });
  return { user: person, account: acc };
};

const issue = ({ user, account }) => credentials.issueLoginCredentials({ userId: user.id, accountId: account.id });

const mailsTo = (email) => mailer.outbox().filter((m) => m.to === email);
const lastMail = (email) => {
  const mails = mailsTo(email);
  expect(mails.length).toBeGreaterThan(0);
  return mails[mails.length - 1];
};
// Temporary password and setup token from the latest welcome email.
const welcomeSecrets = (email) => {
  const mail = lastMail(email);
  expect(mail.template).toBe("welcome-temp-password");
  // "Temporary password: X" (EN) / "كلمة المرور المؤقتة: X" (AR)
  const temporaryPassword = mail.text.match(/(?:Temporary password|كلمة المرور المؤقتة): (\S+)/)[1];
  const setupToken = decodeURIComponent(mail.text.match(/reset-password\?setup=(\S+)/)[1]);
  return { temporaryPassword, setupToken, mail };
};

// Issues credentials to a new person; returns the person and the emailed secrets.
const newLoginWithTemp = async (opts) => {
  const person = await createNewLogin(opts);
  await issue(person);
  return { ...person, ...welcomeSecrets(person.user.email) };
};

const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });
const cookiePair = (res) => {
  const header = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));
  return header ? header.split(";")[0] : undefined;
};
const setup = (body, lang) => {
  const req = request(app).post("/api/auth/setup-password");
  if (lang) req.set("Accept-Language", lang);
  return req.send(body);
};
const setupBody = (token, overrides = {}) => ({
  token,
  newPassword: NEW_PASSWORD,
  confirmPassword: NEW_PASSWORD,
  ...overrides,
});
const me = (token) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

// Guarded routes: a department route (any future router behind requireAuth), plus a
// stand-in for change-password (ticket 09) mounted at its real path.
const guardApp = express();
guardApp.use(language);
guardApp.use(express.json());
guardApp.use(cookieParser());
guardApp.get("/api/departments", requireAuth, requirePermission("department", "create"), (req, res) =>
  res.json({ success: true, data: { ok: true } })
);
guardApp.post("/api/departments", requireAuth, requirePermission("department", "create"), (req, res) =>
  res.json({ success: true, data: { ok: true } })
);
const changeStub = express.Router();
changeStub.post("/change-password", requireAuth, (req, res) => res.json({ success: true, data: { reached: true } }));
changeStub.get("/change-password", requireAuth, (req, res) => res.json({ success: true, data: { reached: true } }));
guardApp.use("/api/auth", changeStub);
guardApp.use("/api/auth", createAuthRouter());
guardApp.use(errorHandler);
const guarded = (method, path, token, lang) => {
  const req = request(guardApp)[method](path).set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req;
};

// ---------- issuing credentials ----------

describe("issueLoginCredentials for a person with no password", () => {
  it("sends the temporary-password welcome email with the email, a temporary password and a setup link", async () => {
    const { user } = await newLoginWithTemp();
    const mails = mailsTo(user.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ template: "welcome-temp-password", lang: "en", subject: "Your login details" });
    expect(mails[0].text).toContain(`Email: ${user.email}`);
  });

  it("stores the temporary password hashed and a hashed setup token valid for 72 hours", async () => {
    const start = new Date("2026-10-19T08:00:00Z");
    fakeClock(start);
    const { user, account, temporaryPassword, setupToken } = await newLoginWithTemp();

    const stored = await db.User.scope("withPassword").findByPk(user.id);
    expect(stored.password).not.toBe(temporaryPassword);
    expect(await bcrypt.compare(temporaryPassword, stored.password)).toBe(true);

    await account.reload();
    expect(account.password_setup_required).toBe(true);
    expect(account.password_setup_token_hash).toBe(sha256(setupToken));
    expect(account.password_setup_token_hash).not.toBe(setupToken);
    expect(new Date(account.password_setup_token_expires_at).getTime()).toBe(start.getTime() + SETUP_TTL);
    expect(account.password_set_at).toBeNull();
  });

  it("generates a 12-character temporary password that meets the password rule", async () => {
    const { temporaryPassword } = await newLoginWithTemp();
    expect(temporaryPassword).toHaveLength(12);
    expect(temporaryPassword).toMatch(PASSWORD_RULE);
  });

  it("always generates rule-compliant, random temporary passwords", () => {
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) {
      const pwd = credentials.generateTemporaryPassword();
      expect(pwd).toHaveLength(12);
      expect(pwd).toMatch(PASSWORD_RULE);
      seen.add(pwd);
    }
    expect(seen.size).toBe(500);
  });

  it("generates a 32-byte base64url setup token", async () => {
    const { setupToken } = await newLoginWithTemp();
    expect(setupToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("sends the email in the person's language (Arabic)", async () => {
    const { user, temporaryPassword, mail } = await newLoginWithTemp({ user: { lang_key: "AR" } });
    expect(mail.lang).toBe("ar");
    expect(mail.subject).toBe("بيانات تسجيل الدخول الخاصة بك");
    expect((await login(user.email, temporaryPassword)).status).toBe(200);
  });

  it("logs in with the temporary password and says the password must be changed", async () => {
    const { user, temporaryPassword } = await newLoginWithTemp();
    const res = await login(user.email, temporaryPassword);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it("works inside a caller's transaction and emails only after it commits", async () => {
    const person = await createNewLogin();
    await db.sequelize.transaction(async (transaction) => {
      await credentials.issueLoginCredentials({ userId: person.user.id, accountId: person.account.id, transaction });
      expect(mailsTo(person.user.email)).toHaveLength(0);
    });
    expect(mailsTo(person.user.email)).toHaveLength(1);
    const { temporaryPassword } = welcomeSecrets(person.user.email);
    expect((await login(person.user.email, temporaryPassword)).status).toBe(200);
  });

  it("changes nothing and sends nothing when the caller's transaction rolls back", async () => {
    const person = await createNewLogin();
    await expect(
      db.sequelize.transaction(async (transaction) => {
        await credentials.issueLoginCredentials({ userId: person.user.id, accountId: person.account.id, transaction });
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");

    expect(mailsTo(person.user.email)).toHaveLength(0);
    const stored = await db.User.scope("withPassword").findByPk(person.user.id);
    expect(stored.password).toBeNull();
    await person.account.reload();
    expect(person.account.password_setup_token_hash).toBeNull();
  });
});

// ---------- the forced-change gate ----------

describe("while the temporary password must be changed", () => {
  let token;
  let cookie;
  beforeAll(async () => {
    mailer.clear();
    const { user, temporaryPassword } = await newLoginWithTemp();
    const res = await login(user.email, temporaryPassword);
    token = res.body.data.accessToken;
    cookie = cookiePair(res);
  });

  it("blocks any other request (e.g. listing departments) with 403 AUTH_PASSWORD_CHANGE_REQUIRED", async () => {
    const res = await guarded("get", "/api/departments", token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_PASSWORD_CHANGE_REQUIRED"));
    expect(res.body.message).toBe("Please change your temporary password to continue.");
  });

  it("blocks writes too", async () => {
    const res = await guarded("post", "/api/departments", token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_PASSWORD_CHANGE_REQUIRED"));
  });

  it("answers in Arabic when asked", async () => {
    const res = await guarded("get", "/api/departments", token, "ar");
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_PASSWORD_CHANGE_REQUIRED", "ar"));
  });

  it("still allows the current user (GET /api/auth/me) and reports mustChangePassword", async () => {
    const res = await me(token);
    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it("allows /api/auth/me with a query string or trailing slash", async () => {
    expect((await guarded("get", "/api/auth/me?x=1", token)).status).toBe(200);
    expect((await guarded("get", "/api/auth/me/", token)).status).toBe(200);
  });

  it("still allows POST /api/auth/change-password", async () => {
    const res = await guarded("post", "/api/auth/change-password", token);
    expect(res.status).toBe(200);
    expect(res.body.data.reached).toBe(true);
  });

  it("allows only POST on the change-password path", async () => {
    const res = await guarded("get", "/api/auth/change-password", token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_PASSWORD_CHANGE_REQUIRED"));
  });

  it("still answers a request without a token with 401 AUTH_REQUIRED", async () => {
    const res = await request(guardApp).get("/api/departments");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("still allows logout", async () => {
    const res = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

describe("a login that doesn't need a password change", () => {
  it("passes the gate", async () => {
    const { employer } = await getCompany();
    const role = await departmentRole(employer);
    const person = await db.User.create({ name: "Sara Khan", email: uniqueEmail("normal"), password: passwordHash });
    await db.HrmsAccount.create({
      user_id: person.id,
      employer_id: employer.id,
      access_level: "SUB_ADMIN",
      role_id: role.id,
      password_setup_required: false,
    });
    const res = await login(person.email, PASSWORD);
    expect(res.body.data.mustChangePassword).toBe(false);
    const guardedRes = await guarded("get", "/api/departments", res.body.data.accessToken);
    expect(guardedRes.status).toBe(200);
  });
});

// ---------- POST /auth/setup-password ----------

describe("POST /api/auth/setup-password", () => {
  it("sets the password and logs the person in (same shape as login)", async () => {
    const { setupToken } = await newLoginWithTemp();
    const res = await setup(setupBody(setupToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Object.keys(res.body.data).sort()).toEqual(["accessToken", "mustChangePassword"]);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(res.body.data.mustChangePassword).toBe(false);
    const cookie = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth(;|$)/);
  });

  it("clears the must-change state: the new token passes the gate and /me says no change needed", async () => {
    const { setupToken } = await newLoginWithTemp();
    const res = await setup(setupBody(setupToken));
    const token = res.body.data.accessToken;

    expect((await guarded("get", "/api/departments", token)).status).toBe(200);
    expect((await me(token)).body.data.mustChangePassword).toBe(false);
  });

  it("lifts the gate for a session opened earlier with the temporary password", async () => {
    const { user, temporaryPassword, setupToken } = await newLoginWithTemp();
    const before = (await login(user.email, temporaryPassword)).body.data.accessToken;
    expect((await guarded("get", "/api/departments", before)).status).toBe(403);

    await setup(setupBody(setupToken));
    expect((await guarded("get", "/api/departments", before)).status).toBe(200);
  });

  it("saves the new password, clears the setup token and records when the password was set", async () => {
    const { user, account, temporaryPassword, setupToken } = await newLoginWithTemp();
    await setup(setupBody(setupToken));

    const stored = await db.User.scope("withPassword").findByPk(user.id);
    expect(await bcrypt.compare(NEW_PASSWORD, stored.password)).toBe(true);
    await account.reload();
    expect(account.password_setup_required).toBe(false);
    expect(account.password_setup_token_hash).toBeNull();
    expect(account.password_setup_token_expires_at).toBeNull();
    expect(account.password_set_at).not.toBeNull();
    expect(Date.now() - new Date(account.password_set_at)).toBeLessThan(60000);
    expect(account.last_login_at).not.toBeNull();

    // The new password logs in without a forced change; the temporary one no longer works.
    const ok = await login(user.email, NEW_PASSWORD);
    expect(ok.status).toBe(200);
    expect(ok.body.data.mustChangePassword).toBe(false);
    const old = await login(user.email, temporaryPassword);
    expect(old.status).toBe(401);
    expect(old.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));
  });

  it("clears a lockout (the link proves the person owns the email, like a reset)", async () => {
    const { user, setupToken } = await newLoginWithTemp();
    await db.User.update(
      { failed_login_attempts: 5, locked_until: new Date(Date.now() + 10 * 60 * 1000) },
      { where: { id: user.id } }
    );
    expect((await setup(setupBody(setupToken))).status).toBe(200);
    const stored = await db.User.findByPk(user.id);
    expect(stored.failed_login_attempts).toBe(0);
    expect(stored.locked_until).toBeNull();
  });

  it("rejects the link once it has been used with 400 AUTH_SETUP_LINK_INVALID", async () => {
    const { setupToken } = await newLoginWithTemp();
    expect((await setup(setupBody(setupToken))).status).toBe(200);

    const res = await setup(setupBody(setupToken, { newPassword: "Another#2026", confirmPassword: "Another#2026" }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));
    expect(res.body.message).toBe("This link is invalid or has expired. Ask your administrator to resend it.");
  });

  it("lets only one of two simultaneous uses of a link succeed", async () => {
    const { setupToken } = await newLoginWithTemp();
    const results = await Promise.all([setup(setupBody(setupToken)), setup(setupBody(setupToken))]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it("answers the invalid-link message in Arabic", async () => {
    const res = await setup(setupBody("not-a-real-token"), "ar");
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID", "ar"));
  });

  it.each([
    ["an unknown token", "x".repeat(43)],
    ["an empty token", ""],
    ["a non-string token", 12345],
  ])("rejects %s with AUTH_SETUP_LINK_INVALID", async (_label, token) => {
    const res = await setup(setupBody(token));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));
  });

  it("rejects a missing token with AUTH_SETUP_LINK_INVALID", async () => {
    const res = await setup({ newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));
  });

  it("accepts the link just before 72 hours and rejects it at 72 hours", async () => {
    const start = new Date("2026-10-19T08:00:00Z");
    fakeClock(start);
    const a = await newLoginWithTemp();
    const b = await newLoginWithTemp();

    advance(SETUP_TTL - 60 * 1000);
    expect((await setup(setupBody(a.setupToken))).status).toBe(200);

    advance(60 * 1000);
    const res = await setup(setupBody(b.setupToken));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));
  });

  it("rejects a token whose account no longer needs setup", async () => {
    const { account, setupToken } = await newLoginWithTemp();
    await db.HrmsAccount.update({ password_setup_required: false }, { where: { id: account.id } });
    const res = await setup(setupBody(setupToken));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));
  });

  describe("account and company checks (D9)", () => {
    it.each(["INACTIVE", "SUSPENDED"])("answers 403 AUTH_ACCOUNT_INACTIVE for a %s account", async (status) => {
      const { account, setupToken } = await newLoginWithTemp();
      await db.HrmsAccount.update({ status }, { where: { id: account.id } });
      const res = await setup(setupBody(setupToken));
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });

    it("answers 403 AUTH_ACCOUNT_INACTIVE for a deleted account", async () => {
      const { account, setupToken } = await newLoginWithTemp();
      await db.HrmsAccount.destroy({ where: { id: account.id } });
      const res = await setup(setupBody(setupToken));
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });

    it("answers 403 AUTH_ACCOUNT_INACTIVE for an inactive person", async () => {
      const { user, setupToken } = await newLoginWithTemp();
      await db.User.update({ user_status: "INACTIVE" }, { where: { id: user.id } });
      const res = await setup(setupBody(setupToken));
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_INACTIVE"));
    });

    it.each(["INACTIVE", "BANNED"])("answers 403 AUTH_COMPANY_INACTIVE when the company is %s", async (status) => {
      const co = await createCompany();
      const { account, setupToken } = await newLoginWithTemp({ employer: co.employer });
      await db.Employer.update({ employer_status: status }, { where: { id: account.employer_id } });
      const res = await setup(setupBody(setupToken));
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("AUTH_COMPANY_INACTIVE"));
    });

    it("leaves the password and token untouched when refused", async () => {
      const { user, account, temporaryPassword, setupToken } = await newLoginWithTemp();
      await db.HrmsAccount.update({ status: "SUSPENDED" }, { where: { id: account.id } });
      await setup(setupBody(setupToken));
      const stored = await db.User.scope("withPassword").findByPk(user.id);
      expect(await bcrypt.compare(temporaryPassword, stored.password)).toBe(true);
      await account.reload();
      expect(account.password_setup_token_hash).toBe(sha256(setupToken));
    });
  });

  describe("password rule and messages (standards §7.2 Reset / Set / Change)", () => {
    let setupToken;
    beforeAll(async () => {
      mailer.clear();
      ({ setupToken } = await newLoginWithTemp());
    });

    it("requires the new password and its confirmation", async () => {
      const res = await setup({ token: setupToken });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        validationBody({ newPassword: "Password is required", confirmPassword: "Please confirm your password" })
      );
    });

    it("treats empty strings as missing", async () => {
      const res = await setup(setupBody(setupToken, { newPassword: "", confirmPassword: "" }));
      expect(res.body).toEqual(
        validationBody({ newPassword: "Password is required", confirmPassword: "Please confirm your password" })
      );
    });

    it.each([
      ["too short", "Ab1!xyz"],
      ["too long", `Ab1!${"x".repeat(69)}`],
      ["no uppercase", "abcdef1!"],
      ["no lowercase", "ABCDEF1!"],
      ["no digit", "Abcdefg!"],
      ["no special character", "Abcdefg1"],
    ])("rejects a password that is %s", async (_label, pwd) => {
      const res = await setup(setupBody(setupToken, { newPassword: pwd, confirmPassword: pwd }));
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ newPassword: WEAK }));
    });

    it("accepts exactly 8 and exactly 72 characters", () => {
      expect("Ab1!xyzw").toMatch(PASSWORD_RULE);
      expect(`Ab1!${"x".repeat(68)}`).toMatch(PASSWORD_RULE);
    });

    it("rejects a confirmation that doesn't match", async () => {
      const res = await setup(setupBody(setupToken, { confirmPassword: "Different#2026" }));
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ confirmPassword: "Passwords do not match" }));
    });

    it("returns the field messages in Arabic", async () => {
      const res = await setup({ token: setupToken, newPassword: "weak", confirmPassword: "other" }, "ar");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ...errorBody("VALIDATION_FAILED", "ar"),
        errors: { newPassword: MESSAGES.AUTH_PASSWORD_WEAK.ar, confirmPassword: MESSAGES.AUTH_PASSWORD_MISMATCH.ar },
      });
    });

    it("leaves the link usable after a validation failure", async () => {
      const res = await setup(setupBody(setupToken));
      expect(res.status).toBe(200);
    });
  });

  it("rejects the temporary password itself as the new one with AUTH_PASSWORD_SAME", async () => {
    const { temporaryPassword, setupToken } = await newLoginWithTemp();
    const res = await setup(setupBody(setupToken, { newPassword: temporaryPassword, confirmPassword: temporaryPassword }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ...errorBody("AUTH_PASSWORD_SAME"),
      errors: { newPassword: MESSAGES.AUTH_PASSWORD_SAME.en },
    });
    // The link still works.
    expect((await setup(setupBody(setupToken))).status).toBe(200);
  });

  it("is rate limited per IP (D11)", async () => {
    const limited = express();
    limited.use(language);
    limited.use(express.json());
    limited.use(cookieParser());
    limited.use("/api/auth", createAuthRouter({ windowMs: 60 * 1000, authMax: 10, refreshMax: 60 }));
    limited.use(errorHandler);

    for (let i = 0; i < 10; i += 1) {
      const res = await request(limited).post("/api/auth/setup-password").send(setupBody("nope"));
      expect(res.status).toBe(400);
    }
    const res = await request(limited).post("/api/auth/setup-password").send(setupBody("nope"));
    expect(res.status).toBe(429);
    expect(res.body).toEqual(errorBody("RATE_LIMITED"));
  });
});

// ---------- expiry ----------

describe("after 72 hours", () => {
  it("logs in with the temporary password just before 72 hours", async () => {
    fakeClock(new Date("2026-10-19T08:00:00Z"));
    const { user, temporaryPassword } = await newLoginWithTemp();
    advance(SETUP_TTL - 60 * 1000);
    const res = await login(user.email, temporaryPassword);
    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it("refuses the temporary password with 403 AUTH_SETUP_EXPIRED and the link with the invalid-link message", async () => {
    fakeClock(new Date("2026-10-19T08:00:00Z"));
    const { user, temporaryPassword, setupToken } = await newLoginWithTemp();
    advance(SETUP_TTL);

    const res = await login(user.email, temporaryPassword);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_SETUP_EXPIRED"));
    expect(res.body.message).toBe("Your temporary password has expired. Ask your administrator to resend it.");
    expect(res.headers["set-cookie"]).toBeUndefined();

    const link = await setup(setupBody(setupToken));
    expect(link.status).toBe(400);
    expect(link.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));
  });

  it("answers AUTH_SETUP_EXPIRED in Arabic", async () => {
    fakeClock(new Date("2026-10-19T08:00:00Z"));
    const { user, temporaryPassword } = await newLoginWithTemp();
    advance(SETUP_TTL + HOUR);
    const res = await request(app)
      .post("/api/auth/login")
      .set("Accept-Language", "ar")
      .send({ email: user.email, password: temporaryPassword });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_SETUP_EXPIRED", "ar"));
  });

  it("still answers AUTH_INVALID_CREDENTIALS for a wrong password", async () => {
    fakeClock(new Date("2026-10-19T08:00:00Z"));
    const { user } = await newLoginWithTemp();
    advance(SETUP_TTL);
    const res = await login(user.email, "Wrong#Pass1");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));
  });
});

// ---------- resend ----------

describe("issuing again (Resend)", () => {
  it("makes the old temporary password and the old link stop working; the new ones work", async () => {
    const { user, account, temporaryPassword: oldPassword, setupToken: oldToken } = await newLoginWithTemp();
    await issue({ user, account });

    const mails = mailsTo(user.email);
    expect(mails).toHaveLength(2);
    const { temporaryPassword: newPassword, setupToken: newToken } = welcomeSecrets(user.email);
    expect(newPassword).not.toBe(oldPassword);
    expect(newToken).not.toBe(oldToken);

    const oldLogin = await login(user.email, oldPassword);
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));

    const oldLink = await setup(setupBody(oldToken));
    expect(oldLink.status).toBe(400);
    expect(oldLink.body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));

    const newLogin = await login(user.email, newPassword);
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.mustChangePassword).toBe(true);
    expect((await setup(setupBody(newToken))).status).toBe(200);
  });

  it("restarts the 72 hours after the old temporary password expired", async () => {
    fakeClock(new Date("2026-10-19T08:00:00Z"));
    const { user, account } = await newLoginWithTemp();
    advance(SETUP_TTL + HOUR);

    await issue({ user, account });
    const { temporaryPassword, setupToken } = welcomeSecrets(user.email);
    await account.reload();
    expect(new Date(account.password_setup_token_expires_at).getTime()).toBe(Date.now() + SETUP_TTL);

    const res = await login(user.email, temporaryPassword);
    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
    expect((await setup(setupBody(setupToken))).status).toBe(200);
  });

  it("sends the existing-password email once the person has set their own password", async () => {
    const { user, account, setupToken } = await newLoginWithTemp();
    await setup(setupBody(setupToken));
    mailer.clear();

    await issue({ user, account });
    expect(lastMail(user.email).template).toBe("welcome-existing-password");
    const ok = await login(user.email, NEW_PASSWORD);
    expect(ok.status).toBe(200);
    expect(ok.body.data.mustChangePassword).toBe(false);
  });
});

// ---------- a person who already has a password ----------

describe("issueLoginCredentials for a person who already has a password", () => {
  // Owned a login at another company that has ended (ADR 0002); now added here.
  const createReturningPerson = async () => {
    const other = await createCompany();
    const person = await db.User.create({ name: "Huda Ali", email: uniqueEmail("returning"), password: passwordHash });
    await db.HrmsAccount.create({
      user_id: person.id,
      employer_id: other.employer.id,
      access_level: "EMPLOYEE",
      status: "INACTIVE",
      password_setup_required: false,
    });
    const { employer } = await getCompany();
    const role = await departmentRole(employer);
    // The model default (password_setup_required true) on purpose: issuing decides it.
    const account = await db.HrmsAccount.create({
      user_id: person.id,
      employer_id: employer.id,
      access_level: "SUB_ADMIN",
      role_id: role.id,
    });
    return { user: person, account };
  };

  it("sends the existing-password email and no temporary password", async () => {
    const person = await createReturningPerson();
    await issue(person);
    const mails = mailsTo(person.user.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ template: "welcome-existing-password", lang: "en", subject: "Your login is ready" });
    expect(mails[0].text).not.toMatch(/Temporary password/);
  });

  it("leaves the password unchanged and doesn't force a change", async () => {
    const person = await createReturningPerson();
    await issue(person);

    const stored = await db.User.scope("withPassword").findByPk(person.user.id);
    expect(stored.password).toBe(passwordHash);
    await person.account.reload();
    expect(person.account.password_setup_required).toBe(false);
    expect(person.account.password_setup_token_hash).toBeNull();
    expect(person.account.password_setup_token_expires_at).toBeNull();

    const res = await login(person.user.email, PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(false);
    expect((await guarded("get", "/api/departments", res.body.data.accessToken)).status).toBe(200);
  });

  it("sends the existing-password email in Arabic", async () => {
    const person = await createReturningPerson();
    await db.User.update({ lang_key: "AR" }, { where: { id: person.user.id } });
    await issue(person);
    expect(lastMail(person.user.email)).toMatchObject({ template: "welcome-existing-password", lang: "ar" });
  });

  it("issues a new temporary password when the earlier one (from an ended login) was never replaced", async () => {
    const other = await createCompany();
    const first = await newLoginWithTemp({ employer: other.employer });
    await db.HrmsAccount.update({ status: "INACTIVE" }, { where: { id: first.account.id } });

    const { employer } = await getCompany();
    const account = await db.HrmsAccount.create({ user_id: first.user.id, employer_id: employer.id, access_level: "EMPLOYEE" });
    await issue({ user: first.user, account });

    const { temporaryPassword, setupToken } = welcomeSecrets(first.user.email);
    expect(temporaryPassword).not.toBe(first.temporaryPassword);
    // The ended login's link is dead; the new one works.
    expect((await setup(setupBody(first.setupToken))).body).toEqual(errorBody("AUTH_SETUP_LINK_INVALID"));
    expect((await login(first.user.email, temporaryPassword)).body.data.mustChangePassword).toBe(true);
    expect((await setup(setupBody(setupToken))).status).toBe(200);
  });
});

// ---------- one current company per email (ADR 0002) ----------

describe("assertEmailFreeForNewAccount", () => {
  const personWith = async (accounts) => {
    const person = await db.User.create({ name: "Ali Hassan", email: uniqueEmail("guard"), password: passwordHash });
    for (const { employer, status = "ACTIVE", deleted = false } of accounts) {
      const acc = await db.HrmsAccount.create({
        user_id: person.id,
        employer_id: employer.id,
        access_level: "EMPLOYEE",
        status,
        password_setup_required: false,
      });
      if (deleted) await acc.destroy();
    }
    return person;
  };

  const expectRejected = async (promise) => {
    let error;
    try {
      await promise;
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe("ACCOUNT_EMAIL_IN_OTHER_COMPANY");
    expect(error.statusCode).toBe(409);
    expect(translate("ACCOUNT_EMAIL_IN_OTHER_COMPANY", "en")).toBe("This email is already used by another company.");
    expect(translate("ACCOUNT_EMAIL_IN_OTHER_COMPANY", "ar")).toBe(MESSAGES.ACCOUNT_EMAIL_IN_OTHER_COMPANY.ar);
  };

  it.each(["ACTIVE", "SUSPENDED"])("rejects an email with a %s account in another company with 409", async (status) => {
    const { employer } = await getCompany();
    const other = await createCompany();
    const person = await personWith([{ employer: other.employer, status }]);
    await expectRejected(credentials.assertEmailFreeForNewAccount(person.email, employer.id));
  });

  it("matches the email case-insensitively and trimmed", async () => {
    const { employer } = await getCompany();
    const other = await createCompany();
    const person = await personWith([{ employer: other.employer }]);
    await expectRejected(credentials.assertEmailFreeForNewAccount(`  ${person.email.toUpperCase()} `, employer.id));
  });

  it("allows an email whose other accounts have all ended (inactive or deleted)", async () => {
    const { employer } = await getCompany();
    const a = await createCompany();
    const b = await createCompany();
    const person = await personWith([
      { employer: a.employer, status: "INACTIVE" },
      { employer: b.employer, status: "ACTIVE", deleted: true },
    ]);
    await expect(credentials.assertEmailFreeForNewAccount(person.email, employer.id)).resolves.toBeUndefined();
  });

  it("allows an unknown email", async () => {
    const { employer } = await getCompany();
    await expect(credentials.assertEmailFreeForNewAccount(uniqueEmail("nobody"), employer.id)).resolves.toBeUndefined();
  });

  it("allows a person with no accounts", async () => {
    const { employer } = await getCompany();
    const person = await personWith([]);
    await expect(credentials.assertEmailFreeForNewAccount(person.email, employer.id)).resolves.toBeUndefined();
  });

  it("doesn't treat a current account in the same company as another company", async () => {
    const { employer } = await getCompany();
    const person = await personWith([{ employer }]);
    await expect(credentials.assertEmailFreeForNewAccount(person.email, employer.id)).resolves.toBeUndefined();
  });

  it("rejects the owner of another company", async () => {
    const { employer } = await getCompany();
    const other = await createCompany();
    await expectRejected(credentials.assertEmailFreeForNewAccount(other.owner.email, employer.id));
  });
});
