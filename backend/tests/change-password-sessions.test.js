const crypto = require("crypto");
const request = require("supertest");
const bcrypt = require("bcrypt");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const mailer = require("../src/services/mailer");
const { build } = require("./helpers/factory");
const credentials = require("../src/services/credentials.service");
const { describeDevice } = require("../src/utils/userAgent");
const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");

// Change password and session management (ticket auth-company#09; D10, D14, D15, D24).

const PASSWORD = "Test@12345";
const NEW_PASSWORD = "Change#2026x";
const COOKIE = "refresh_token";
const WEAK = MESSAGES.AUTH_PASSWORD_WEAK.en;
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const errorBody = (code, lang = "en") => ({ success: false, code, message: MESSAGES[code][lang] });
const validationBody = (errors, lang = "en") => ({ ...errorBody("VALIDATION_FAILED", lang), errors });

let passwordHash;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  mailer.clear();
  // Failed logins are logged with console.warn; keep the test output quiet.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  await db.sequelize.close();
});

// ---------- helpers ----------

const uniqueEmail = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}@hrms.test`;

const createCompany = async () => {
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: passwordHash });
  const employer = await build(db, "Employer", { user_id: owner.id, company_name: "Al Noor Construction", employer_status: "ACTIVE" });
  await db.CompanyTimeSetting.create({ employer_id: employer.id, timezone: "Asia/Riyadh" });
  await db.HrmsAccount.create({ user_id: owner.id, employer_id: employer.id, access_level: "ADMIN", password_setup_required: false });
  return { owner, employer };
};

let company;
const getCompany = async () => {
  company = company || (await createCompany());
  return company;
};

const createLogin = async ({ accessLevel = "EMPLOYEE", user = {}, account = {} } = {}) => {
  const { employer } = await getCompany();
  const person = await db.User.create({ name: "Sara Khan", email: uniqueEmail("person"), password: passwordHash, ...user });
  const acc = await db.HrmsAccount.create({
    user_id: person.id,
    employer_id: employer.id,
    access_level: accessLevel,
    password_setup_required: false,
    ...account,
  });
  return { user: person, account: acc };
};

const cookiePair = (res) => {
  const header = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));
  return header ? header.split(";")[0] : undefined;
};

// Logs in and returns { token, cookie, sessionId }.
const loginAs = async (email, { password = PASSWORD, userAgent = CHROME_WINDOWS } = {}) => {
  const res = await request(app).post("/api/auth/login").set("User-Agent", userAgent).send({ email, password });
  expect(res.status).toBe(200);
  const token = res.body.data.accessToken;
  return { token, cookie: cookiePair(res), sessionId: JSON.parse(Buffer.from(token.split(".")[1], "base64url")).sid };
};

const changePassword = (token, body, lang) => {
  const req = request(app).post("/api/auth/change-password");
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req.send(body);
};
const changeBody = (overrides = {}) => ({
  currentPassword: PASSWORD,
  newPassword: NEW_PASSWORD,
  confirmPassword: NEW_PASSWORD,
  ...overrides,
});
const listSessions = (token, lang) => {
  const req = request(app).get("/api/auth/sessions");
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req;
};
const revoke = (token, body, lang) => {
  const req = request(app).post("/api/auth/sessions/revoke");
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req.send(body);
};
const me = (token) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
const refresh = (cookie) => request(app).post("/api/auth/refresh").set("Cookie", cookie);
const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });
const statusOf = async (id) => (await db.HrmsSession.findByPk(id)).status;

// ---------- POST /api/auth/change-password ----------

describe("POST /api/auth/change-password", () => {
  describe("success", () => {
    it("changes the password: new logs in, old doesn't, current session keeps working", async () => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      const other = await loginAs(user.email);

      const res = await changePassword(s.token, changeBody());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      const stored = await db.User.scope("withPassword").findByPk(user.id);
      expect(await bcrypt.compare(NEW_PASSWORD, stored.password)).toBe(true);
      expect(stored.password.startsWith("$2b$12$")).toBe(true);

      expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
      const old = await login(user.email, PASSWORD);
      expect(old.status).toBe(401);
      expect(old.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));

      // The API never ends sessions on a change (the UI asks which ones to end).
      expect((await me(s.token)).status).toBe(200);
      expect(await statusOf(s.sessionId)).toBe("ACTIVE");
      expect(await statusOf(other.sessionId)).toBe("ACTIVE");
      expect((await refresh(other.cookie)).status).toBe(200);
    });

    it("clears the failed-attempt counter", async () => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      await changePassword(s.token, changeBody({ currentPassword: "Wrong#12345" }));
      await changePassword(s.token, changeBody({ currentPassword: "Wrong#12345" }));
      expect((await db.User.findByPk(user.id)).failed_login_attempts).toBe(2);

      expect((await changePassword(s.token, changeBody())).status).toBe(200);
      const after = await db.User.findByPk(user.id);
      expect(after.failed_login_attempts).toBe(0);
      expect(after.locked_until).toBeNull();
    });

    it("works for every access level", async () => {
      for (const accessLevel of ["ADMIN", "SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"]) {
        const { user } = await createLogin({ accessLevel });
        const s = await loginAs(user.email);
        const res = await changePassword(s.token, changeBody());
        expect(res.status).toBe(200);
      }
    });

    it("lets a temporary-password login change it: mustChangePassword becomes false and the gate lifts", async () => {
      const { user, account } = await createLogin({ user: { password: null }, account: { password_setup_required: true } });
      await credentials.issueLoginCredentials({ userId: user.id, accountId: account.id });
      const mail = mailer.outbox().filter((m) => m.to === user.email).pop();
      const temporaryPassword = mail.text.match(/Temporary password: (\S+)/)[1];

      const loginRes = await login(user.email, temporaryPassword);
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.mustChangePassword).toBe(true);
      const token = loginRes.body.data.accessToken;

      // Gated before the change.
      const gated = await listSessions(token);
      expect(gated.status).toBe(403);
      expect(gated.body).toEqual(errorBody("AUTH_PASSWORD_CHANGE_REQUIRED"));

      const res = await changePassword(
        token,
        changeBody({ currentPassword: temporaryPassword, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
      );
      expect(res.status).toBe(200);

      const acc = await db.HrmsAccount.findByPk(account.id);
      expect(acc.password_setup_required).toBe(false);
      expect(acc.password_setup_token_hash).toBeNull();
      expect(acc.password_setup_token_expires_at).toBeNull();
      expect(acc.password_set_at).not.toBeNull();

      expect((await me(token)).body.data.mustChangePassword).toBe(false);
      expect((await listSessions(token)).status).toBe(200);
      const relog = await login(user.email, NEW_PASSWORD);
      expect(relog.body.data.mustChangePassword).toBe(false);
    });
  });

  describe("wrong current password and lockout", () => {
    it("answers 400 AUTH_CURRENT_PASSWORD_WRONG with the field message and counts the attempt", async () => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      const res = await changePassword(s.token, changeBody({ currentPassword: "Wrong#12345" }));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ...errorBody("AUTH_CURRENT_PASSWORD_WRONG"),
        errors: { currentPassword: "Your current password is incorrect." },
      });
      expect((await db.User.findByPk(user.id)).failed_login_attempts).toBe(1);
      const stored = await db.User.scope("withPassword").findByPk(user.id);
      expect(await bcrypt.compare(PASSWORD, stored.password)).toBe(true);
    });

    it("the fifth wrong attempt in a row → 423 and the current session ends", async () => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      const other = await loginAs(user.email);

      for (let i = 0; i < 4; i += 1) {
        expect((await changePassword(s.token, changeBody({ currentPassword: "Wrong#12345" }))).status).toBe(400);
      }
      const res = await changePassword(s.token, changeBody({ currentPassword: "Wrong#12345" }));
      expect(res.status).toBe(423);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_LOCKED"));
      expect(res.body.message).toBe("Too many failed attempts. Try again in 15 minutes.");

      const locked = await db.User.findByPk(user.id);
      expect(locked.failed_login_attempts).toBe(5);
      expect(new Date(locked.locked_until).getTime()).toBeGreaterThan(Date.now());

      expect(await statusOf(s.sessionId)).toBe("REVOKED");
      const next = await me(s.token);
      expect(next.status).toBe(401);
      expect(next.body).toEqual(errorBody("AUTH_REQUIRED"));
      expect((await refresh(s.cookie)).status).toBe(401);
      // Only the current session ends.
      expect(await statusOf(other.sessionId)).toBe("ACTIVE");

      // Login is locked too.
      expect((await login(user.email, PASSWORD)).status).toBe(423);
    });

    it("while locked → 423 even with the right password, and the current session ends", async () => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      await user.update({ failed_login_attempts: 5, locked_until: new Date(Date.now() + 10 * 60 * 1000) });

      const res = await changePassword(s.token, changeBody());
      expect(res.status).toBe(423);
      expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_LOCKED"));
      expect(await statusOf(s.sessionId)).toBe("REVOKED");
      const stored = await db.User.scope("withPassword").findByPk(user.id);
      expect(await bcrypt.compare(PASSWORD, stored.password)).toBe(true);
    });

    it("counts login failures and change-password failures together", async () => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      for (let i = 0; i < 4; i += 1) await login(user.email, "Wrong#12345");
      const res = await changePassword(s.token, changeBody({ currentPassword: "Wrong#12345" }));
      expect(res.status).toBe(423);
    });
  });

  describe("new password rules", () => {
    it("same as current → AUTH_PASSWORD_SAME with the field message, nothing changes", async () => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      const res = await changePassword(s.token, changeBody({ newPassword: PASSWORD, confirmPassword: PASSWORD }));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ...errorBody("AUTH_PASSWORD_SAME"),
        errors: { newPassword: "New password must be different from your current one." },
      });
      expect(await statusOf(s.sessionId)).toBe("ACTIVE");
    });

    it.each([
      ["missing everything", {}, {
        currentPassword: "Password is required",
        newPassword: "Password is required",
        confirmPassword: "Please confirm your password",
      }],
      ["empty strings", { currentPassword: "", newPassword: "", confirmPassword: "" }, {
        currentPassword: "Password is required",
        newPassword: "Password is required",
        confirmPassword: "Please confirm your password",
      }],
      ["weak new password", { currentPassword: PASSWORD, newPassword: "weakpass", confirmPassword: "weakpass" }, {
        newPassword: WEAK,
      }],
      ["no special character", { currentPassword: PASSWORD, newPassword: "Abcdefg1", confirmPassword: "Abcdefg1" }, {
        newPassword: WEAK,
      }],
      ["too long", { currentPassword: PASSWORD, newPassword: `Aa1!${"x".repeat(69)}`, confirmPassword: `Aa1!${"x".repeat(69)}` }, {
        newPassword: WEAK,
      }],
      ["mismatch", { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: "Other#2026x" }, {
        confirmPassword: "Passwords do not match",
      }],
    ])("%s → 400 with field messages", async (_label, body, errors) => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      const res = await changePassword(s.token, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody(errors));
      expect((await db.User.findByPk(user.id)).failed_login_attempts).toBe(0);
    });

    it("answers in Arabic", async () => {
      const { user } = await createLogin();
      const s = await loginAs(user.email);
      const invalid = await changePassword(s.token, { currentPassword: "", newPassword: "weakpass", confirmPassword: "x" }, "ar");
      expect(invalid.body).toEqual(
        validationBody(
          {
            currentPassword: FIELD_MESSAGES.passwordRequired.ar,
            newPassword: MESSAGES.AUTH_PASSWORD_WEAK.ar,
            confirmPassword: MESSAGES.AUTH_PASSWORD_MISMATCH.ar,
          },
          "ar"
        )
      );
      const wrong = await changePassword(s.token, changeBody({ currentPassword: "Wrong#12345" }), "ar");
      expect(wrong.body).toEqual({
        ...errorBody("AUTH_CURRENT_PASSWORD_WRONG", "ar"),
        errors: { currentPassword: MESSAGES.AUTH_CURRENT_PASSWORD_WRONG.ar },
      });
    });
  });

  it("401 without or with an invalid token", async () => {
    const none = await changePassword(null, changeBody());
    expect(none.status).toBe(401);
    expect(none.body).toEqual(errorBody("AUTH_REQUIRED"));
    const bad = await changePassword("garbage", changeBody());
    expect(bad.status).toBe(401);
    expect(bad.body).toEqual(errorBody("AUTH_REQUIRED"));
  });
});

// ---------- GET /api/auth/sessions ----------

describe("GET /api/auth/sessions", () => {
  it("lists only the caller's active sessions with device, IP, times and the current flag", async () => {
    const { user } = await createLogin();
    const a = await loginAs(user.email, { userAgent: CHROME_WINDOWS });
    const b = await loginAs(user.email, { userAgent: SAFARI_IPHONE });
    const ended = await loginAs(user.email);
    await revoke(a.token, { sessionIds: [ended.sessionId] });
    const expired = await loginAs(user.email);
    await db.HrmsSession.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id: expired.sessionId } });

    // Someone else's session in the same company.
    const { user: stranger } = await createLogin();
    const strangerSession = await loginAs(stranger.email);

    await db.HrmsSession.update({ last_used_at: new Date(Date.now() + 60 * 1000) }, { where: { id: b.sessionId } });

    const res = await listSessions(a.token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const items = res.body.data;
    expect(items.map((s) => s.id)).toEqual([b.sessionId, a.sessionId]);
    expect(items.map((s) => s.id)).not.toContain(strangerSession.sessionId);

    const [first, second] = items;
    expect(Object.keys(first).sort()).toEqual(["created_at", "current", "device", "id", "ip", "last_used_at"]);
    expect(first).toMatchObject({ device: "Safari on iOS", current: false });
    expect(second).toMatchObject({ device: "Chrome on Windows", current: true });
    expect(typeof second.ip).toBe("string");
    expect(new Date(second.created_at).toString()).not.toBe("Invalid Date");
    expect(new Date(second.last_used_at).toString()).not.toBe("Invalid Date");
  });

  it("does not list the person's sessions on another account", async () => {
    const { user, account } = await createLogin();
    const s = await loginAs(user.email);
    const otherCompany = await createCompany();
    const oldAccount = await db.HrmsAccount.create({
      user_id: user.id,
      employer_id: otherCompany.employer.id,
      access_level: "EMPLOYEE",
      status: "INACTIVE",
      password_setup_required: false,
    });
    const foreign = await db.HrmsSession.create({
      hrms_account_id: oldAccount.id,
      access_token_hash: "x",
      refresh_token_hash: crypto.randomBytes(16).toString("hex"),
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    });
    const res = await listSessions(s.token);
    expect(res.body.data.map((x) => x.id)).toEqual([s.sessionId]);
    expect(res.body.data.map((x) => x.id)).not.toContain(foreign.id);
    expect(account.id).not.toBe(oldAccount.id);
  });

  it("works for every access level", async () => {
    for (const accessLevel of ["ADMIN", "SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"]) {
      const { user } = await createLogin({ accessLevel });
      const s = await loginAs(user.email);
      const res = await listSessions(s.token);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    }
  });

  it("401 without or with an invalid token (Arabic too)", async () => {
    const none = await listSessions(null);
    expect(none.status).toBe(401);
    expect(none.body).toEqual(errorBody("AUTH_REQUIRED"));
    const ar = await listSessions("garbage", "ar");
    expect(ar.status).toBe(401);
    expect(ar.body).toEqual(errorBody("AUTH_REQUIRED", "ar"));
  });
});

// ---------- POST /api/auth/sessions/revoke ----------

describe("POST /api/auth/sessions/revoke", () => {
  const threeSessions = async () => {
    const { user, account } = await createLogin();
    const current = await loginAs(user.email);
    const b = await loginAs(user.email);
    const c = await loginAs(user.email);
    return { user, account, current, b, c };
  };

  it("ends the selected sessions: their refresh cookies stop working, others keep working", async () => {
    const { current, b, c } = await threeSessions();
    const res = await revoke(current.token, { sessionIds: [b.sessionId] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { revoked: 1 } });

    expect(await statusOf(b.sessionId)).toBe("REVOKED");
    const dead = await refresh(b.cookie);
    expect(dead.status).toBe(401);
    expect(dead.body).toEqual(errorBody("AUTH_REFRESH_INVALID"));
    expect((await me(b.token)).status).toBe(401);
    // A late cookie is unknown, not "reuse": the other sessions survive.
    expect(await statusOf(c.sessionId)).toBe("ACTIVE");
    expect(await statusOf(current.sessionId)).toBe("ACTIVE");
    expect((await refresh(c.cookie)).status).toBe(200);
    expect((await me(current.token)).status).toBe(200);
  });

  it("ends several selected sessions at once", async () => {
    const { current, b, c } = await threeSessions();
    const res = await revoke(current.token, { sessionIds: [b.sessionId, c.sessionId] });
    expect(res.body).toEqual({ success: true, data: { revoked: 2 } });
    expect(await statusOf(b.sessionId)).toBe("REVOKED");
    expect(await statusOf(c.sessionId)).toBe("REVOKED");
    expect(await statusOf(current.sessionId)).toBe("ACTIVE");
  });

  it("all → ends every session except the current one", async () => {
    const { current, b, c } = await threeSessions();
    const res = await revoke(current.token, { all: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { revoked: 2 } });
    expect(await statusOf(b.sessionId)).toBe("REVOKED");
    expect(await statusOf(c.sessionId)).toBe("REVOKED");
    expect((await refresh(b.cookie)).status).toBe(401);
    expect((await refresh(c.cookie)).status).toBe(401);
    expect(await statusOf(current.sessionId)).toBe("ACTIVE");
    expect((await me(current.token)).status).toBe(200);

    const list = await listSessions(current.token);
    expect(list.body.data.map((s) => s.id)).toEqual([current.sessionId]);
  });

  it("all with no other sessions → revoked 0", async () => {
    const { user } = await createLogin();
    const s = await loginAs(user.email);
    const res = await revoke(s.token, { all: true });
    expect(res.body).toEqual({ success: true, data: { revoked: 0 } });
  });

  it("including the current session → 400 SESSION_REVOKE_CURRENT and nothing is ended", async () => {
    const { current, b } = await threeSessions();
    const res = await revoke(current.token, { sessionIds: [b.sessionId, current.sessionId] });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("SESSION_REVOKE_CURRENT"));
    expect(res.body.message).toBe("You can't end your current session here. Use Log out instead.");
    expect(await statusOf(b.sessionId)).toBe("ACTIVE");
    expect(await statusOf(current.sessionId)).toBe("ACTIVE");

    const ar = await revoke(current.token, { sessionIds: [current.sessionId] }, "ar");
    expect(ar.body).toEqual(errorBody("SESSION_REVOKE_CURRENT", "ar"));
  });

  it("including another person's session → 404 and nothing is ended", async () => {
    const { current, b } = await threeSessions();
    const { user: stranger } = await createLogin();
    const theirs = await loginAs(stranger.email);

    const res = await revoke(current.token, { sessionIds: [b.sessionId, theirs.sessionId] });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
    expect(res.body.message).toBe("The requested record was not found.");
    expect(await statusOf(b.sessionId)).toBe("ACTIVE");
    expect(await statusOf(theirs.sessionId)).toBe("ACTIVE");

    const ar = await revoke(current.token, { sessionIds: [theirs.sessionId] }, "ar");
    expect(ar.status).toBe(404);
    expect(ar.body).toEqual(errorBody("NOT_FOUND", "ar"));
  });

  it("another company's session → 404", async () => {
    const { current } = await threeSessions();
    const otherCompany = await createCompany();
    const theirs = await loginAs(otherCompany.owner.email);
    const res = await revoke(current.token, { sessionIds: [theirs.sessionId] });
    expect(res.status).toBe(404);
    expect(await statusOf(theirs.sessionId)).toBe("ACTIVE");
  });

  it("an already-ended, expired or unknown session → 404 and nothing is ended", async () => {
    const { current, b, c } = await threeSessions();
    await revoke(current.token, { sessionIds: [c.sessionId] });

    const ended = await revoke(current.token, { sessionIds: [b.sessionId, c.sessionId] });
    expect(ended.status).toBe(404);
    expect(ended.body).toEqual(errorBody("NOT_FOUND"));
    expect(await statusOf(b.sessionId)).toBe("ACTIVE");

    const unknown = await revoke(current.token, { sessionIds: [crypto.randomUUID()] });
    expect(unknown.status).toBe(404);

    await db.HrmsSession.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id: b.sessionId } });
    const expired = await revoke(current.token, { sessionIds: [b.sessionId] });
    expect(expired.status).toBe(404);
  });

  it("ignores repeated ids", async () => {
    const { current, b } = await threeSessions();
    const res = await revoke(current.token, { sessionIds: [b.sessionId, b.sessionId] });
    expect(res.body).toEqual({ success: true, data: { revoked: 1 } });
  });

  it.each([
    ["empty body", {}, "sessionIds"],
    ["both given", { all: true, sessionIds: [crypto.randomUUID()] }, "sessionIds"],
    ["empty list", { sessionIds: [] }, "sessionIds"],
    ["not an array", { sessionIds: "abc" }, "sessionIds"],
    ["not a uuid", { sessionIds: ["abc"] }, "sessionIds.0"],
    ["all false", { all: false }, "all"],
    ["all not a boolean", { all: "yes" }, "all"],
  ])("%s → 400 VALIDATION_FAILED", async (_label, body, field) => {
    const { current, b } = await threeSessions();
    const res = await revoke(current.token, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ [field]: MESSAGES.VALIDATION_FAILED.en }));
    expect(await statusOf(b.sessionId)).toBe("ACTIVE");
  });

  it("works for every access level", async () => {
    for (const accessLevel of ["ADMIN", "SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"]) {
      const { user } = await createLogin({ accessLevel });
      const s = await loginAs(user.email);
      const other = await loginAs(user.email);
      const res = await revoke(s.token, { sessionIds: [other.sessionId] });
      expect(res.body).toEqual({ success: true, data: { revoked: 1 } });
    }
  });

  it("is gated while a temporary password must be changed", async () => {
    const { user } = await createLogin({ account: { password_setup_required: true } });
    const s = await loginAs(user.email);
    const res = await revoke(s.token, { all: true });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("AUTH_PASSWORD_CHANGE_REQUIRED"));
  });

  it("401 without or with an invalid token", async () => {
    const none = await revoke(null, { all: true });
    expect(none.status).toBe(401);
    expect(none.body).toEqual(errorBody("AUTH_REQUIRED"));
    const bad = await revoke("garbage", { all: true });
    expect(bad.status).toBe(401);
  });
});

// ---------- device names ----------

describe("describeDevice", () => {
  it.each([
    [CHROME_WINDOWS, "Chrome on Windows"],
    [SAFARI_IPHONE, "Safari on iOS"],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      "Safari on macOS",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0", "Firefox on Linux"],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      "Chrome on Android",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0",
      "Opera on Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
      "Chrome on iOS",
    ],
    ["curl/8.4.0", "Unknown device"],
    ["", "Unknown device"],
    [null, "Unknown device"],
  ])("%s → %s", (ua, expected) => {
    expect(describeDevice(ua)).toBe(expected);
  });
});
