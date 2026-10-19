jest.mock("nodemailer");

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
const { useFailingSmtp, waitForCall, SMTP_PASS } = require("./helpers/smtp");
const language = require("../src/middlewares/language");
const errorHandler = require("../src/middlewares/errorHandler");
const { createAuthRouter } = require("../src/routes/auth.routes");
const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");

// Forgot password → verify code → reset (ticket auth-company#07, D14, D18, ADR 0001).

const PASSWORD = "Test@12345";
const NEW_PASSWORD = "Reset#2026x";
const COOKIE = "refresh_token";
const MINUTE = 60 * 1000;
const WEAK = MESSAGES.AUTH_PASSWORD_WEAK.en;

const errorBody = (code) => ({ success: false, code, message: MESSAGES[code].en });
const validationBody = (errors) => ({ ...errorBody("VALIDATION_FAILED"), errors });
const SENT_BODY = { success: true, code: "AUTH_RESET_SENT", message: MESSAGES.AUTH_RESET_SENT.en };

let passwordHash;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
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

let company;
const getCompany = async () => {
  if (company) return company;
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: passwordHash });
  const employer = await build(db, "Employer", { user_id: owner.id, company_name: "Al Noor Construction" });
  await db.CompanyTimeSetting.create({ employer_id: employer.id, timezone: "Asia/Riyadh" });
  company = { owner, employer };
  return company;
};

// A person with one login (ACTIVE unless told otherwise).
const createPerson = async ({ user = {}, account = {} } = {}) => {
  const { employer } = await getCompany();
  const person = await db.User.create({ name: "Omar Saleh", email: uniqueEmail("person"), password: passwordHash, ...user });
  const acc = await db.HrmsAccount.create({
    user_id: person.id,
    employer_id: employer.id,
    access_level: "EMPLOYEE",
    password_setup_required: false,
    ...account,
  });
  return { user: person, account: acc };
};

const post = (path, body, lang) => {
  const req = request(app).post(`/api/auth/${path}`);
  if (lang) req.set("Accept-Language", lang);
  return req.send(body);
};
const forgot = (email, lang) => post("forgot-password", { email }, lang);
const verify = (email, otp, lang) => post("verify-otp", { email, otp }, lang);
const reset = (body, lang) => post("reset-password", body, lang);
const resetBody = (resetToken, overrides = {}) => ({
  resetToken,
  newPassword: NEW_PASSWORD,
  confirmPassword: NEW_PASSWORD,
  ...overrides,
});

const login = (email, password = PASSWORD) => request(app).post("/api/auth/login").send({ email, password });
const cookiePair = (res) => {
  const header = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));
  return header ? header.split(";")[0] : undefined;
};
const refresh = (cookie) => request(app).post("/api/auth/refresh").set("Cookie", cookie);

const mailsTo = (email) => mailer.outbox().filter((m) => m.to === email);
// The code from the latest reset email to this address.
const lastCode = (email) => {
  const mails = mailsTo(email);
  expect(mails.length).toBeGreaterThan(0);
  return mails[mails.length - 1].text.match(/(\d{6})/)[1];
};
const wrongCodeFor = (code) => String((Number(code) + 1) % 1000000).padStart(6, "0");

const otpRowsOf = (userId) => db.PasswordResetOtp.findAll({ where: { user_id: userId }, order: [["created_at", "ASC"]] });

// Requests a code and verifies it; returns the reset token.
const resetTokenFor = async (email) => {
  expect((await forgot(email)).status).toBe(200);
  const res = await verify(email, lastCode(email));
  expect(res.status).toBe(200);
  return res.body.data.resetToken;
};

// ---------- POST /auth/forgot-password ----------

describe("POST /api/auth/forgot-password", () => {
  it("answers a known email with 200 and the neutral message, and emails a 6-digit code", async () => {
    const { user } = await createPerson();
    const res = await forgot(user.email);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(SENT_BODY);
    expect(res.body.message).toBe("If an account exists for this email, you'll receive a reset code.");

    const mails = mailsTo(user.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ template: "reset-otp", lang: "en", subject: "Your password reset code" });
    expect(mails[0].text).toMatch(/Your password reset code is: \d{6}\n/);
  });

  it("stores only a hash of the code, valid for 10 minutes, with no attempts", async () => {
    const start = new Date("2026-10-19T08:00:00Z");
    fakeClock(start);
    const { user } = await createPerson();
    await forgot(user.email);
    const code = lastCode(user.email);

    const [row] = await otpRowsOf(user.id);
    expect(row.otp_hash).not.toBe(code);
    expect(row.otp_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.otp_hash).toBe(crypto.createHash("sha256").update(code).digest("hex"));
    expect(new Date(row.expires_at).getTime()).toBe(start.getTime() + 10 * MINUTE);
    expect(row.attempts).toBe(0);
    expect(row.consumed_at).toBeNull();
  });

  it("answers an unknown email with the identical body and sends nothing", async () => {
    const { user } = await createPerson();
    const known = await forgot(user.email);
    const unknownEmail = uniqueEmail("nobody");
    const unknown = await forgot(unknownEmail);

    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(mailsTo(unknownEmail)).toHaveLength(0);
    expect(mailer.outbox()).toHaveLength(1);
  });

  it("does the same work (generates and hashes a code) for an unknown email", async () => {
    const randomInt = jest.spyOn(crypto, "randomInt");
    await forgot(uniqueEmail("nobody"));
    expect(randomInt).toHaveBeenCalled();
  });

  it("matches the email case-insensitively and trims it", async () => {
    const { user } = await createPerson();
    const res = await forgot(`  ${user.email.toUpperCase()} `);
    expect(res.body).toEqual(SENT_BODY);
    expect(mailsTo(user.email)).toHaveLength(1);
  });

  it("answers with the same 200 body when SMTP delivery fails, stores the code and logs the failure safely", async () => {
    const { user } = await createPerson();
    const smtp = useFailingSmtp(new Error(`Invalid login: 535 rejected mailer@hrms.test/${SMTP_PASS}`));
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await forgot(user.email);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(SENT_BODY);

      await waitForCall(error);
      expect(smtp.sendMail).toHaveBeenCalledTimes(1);
      expect(smtp.sendMail.mock.calls[0][0]).toMatchObject({ to: user.email, subject: "Your password reset code" });
      expect(await otpRowsOf(user.id)).toHaveLength(1);

      const logged = error.mock.calls.map((args) => JSON.stringify(args)).join("\n");
      expect(logged).toContain("[auth] reset code email failed");
      expect(logged).toContain("Invalid login: 535");
      expect(logged).not.toContain(SMTP_PASS);
      const code = smtp.sendMail.mock.calls[0][0].text.match(/(\d{6})/)[1];
      expect(logged).not.toContain(code);
    } finally {
      smtp.restore();
    }
  });

  describe("sends a code only to a person who can still log in somewhere", () => {
    it.each([
      ["an INACTIVE person", { user: { user_status: "INACTIVE" } }],
      ["a BLOCKED person", { user: { user_status: "BLOCKED" } }],
      ["a person whose only login is SUSPENDED", { account: { status: "SUSPENDED" } }],
      ["a person whose only login has ended", { account: { status: "INACTIVE" } }],
    ])("%s: same neutral 200, no email", async (_label, overrides) => {
      const { user } = await createPerson(overrides);
      const res = await forgot(user.email);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(SENT_BODY);
      expect(mailsTo(user.email)).toHaveLength(0);
      expect(await otpRowsOf(user.id)).toHaveLength(0);
    });

    it("a deleted person: same neutral 200, no email", async () => {
      const { user } = await createPerson();
      await user.destroy();
      const res = await forgot(user.email);
      expect(res.body).toEqual(SENT_BODY);
      expect(mailsTo(user.email)).toHaveLength(0);
    });

    it("a person with no login at all: same neutral 200, no email", async () => {
      const person = await db.User.create({ name: "No Login", email: uniqueEmail("nologin"), password: passwordHash });
      const res = await forgot(person.email);
      expect(res.body).toEqual(SENT_BODY);
      expect(mailsTo(person.email)).toHaveLength(0);
    });
  });

  it("emails the code in Arabic to a person whose language is Arabic", async () => {
    const { user } = await createPerson({ user: { lang_key: "AR" } });
    await forgot(user.email);
    const [mail] = mailsTo(user.email);
    expect(mail.lang).toBe("ar");
    expect(mail.subject).toBe("رمز إعادة تعيين كلمة المرور");
    expect(mail.text).toMatch(/\d{6}/);
  });

  it("answers the neutral message in Arabic when asked", async () => {
    const res = await forgot(uniqueEmail("nobody"), "ar");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, code: "AUTH_RESET_SENT", message: MESSAGES.AUTH_RESET_SENT.ar });
  });

  describe("validation", () => {
    it.each([
      ["missing", {}, "Email is required"],
      ["empty", { email: "" }, "Email is required"],
      ["invalid", { email: "not-an-email" }, "Invalid email address"],
    ])("email %s → 400 with the field message", async (_label, body, message) => {
      const res = await post("forgot-password", body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ email: message }));
    });

    it("answers field messages in Arabic", async () => {
      const res = await post("forgot-password", {}, "ar");
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual({ email: FIELD_MESSAGES.emailRequired.ar });
    });
  });

  describe("resend throttling", () => {
    const tooSoon = (res) => {
      expect(res.status).toBe(429);
      expect(res.body).toEqual(errorBody("AUTH_OTP_RESEND_TOO_SOON"));
      expect(res.body.message).toBe("Please wait before requesting another code.");
    };

    it("refuses a second request within 60 seconds, and allows it after", async () => {
      fakeClock(new Date("2026-10-19T08:00:00Z"));
      const { user } = await createPerson();
      expect((await forgot(user.email)).status).toBe(200);

      advance(59 * 1000);
      tooSoon(await forgot(user.email));
      expect(mailsTo(user.email)).toHaveLength(1);

      advance(1000);
      expect((await forgot(user.email)).status).toBe(200);
      expect(mailsTo(user.email)).toHaveLength(2);
    });

    it("throttles an unknown email the same way", async () => {
      fakeClock(new Date("2026-10-19T08:00:00Z"));
      const email = uniqueEmail("nobody");
      expect((await forgot(email)).status).toBe(200);
      advance(30 * 1000);
      tooSoon(await forgot(email));
    });

    it("counts the email case-insensitively", async () => {
      fakeClock(new Date("2026-10-19T08:00:00Z"));
      const email = uniqueEmail("nobody");
      expect((await forgot(email)).status).toBe(200);
      tooSoon(await forgot(email.toUpperCase()));
    });

    it("allows at most 5 requests per rolling hour", async () => {
      const start = new Date("2026-10-19T08:00:00Z");
      fakeClock(start);
      const { user } = await createPerson();
      for (let i = 0; i < 5; i += 1) {
        if (i > 0) advance(61 * 1000);
        expect((await forgot(user.email)).status).toBe(200);
      }

      advance(61 * 1000);
      tooSoon(await forgot(user.email));
      expect(mailsTo(user.email)).toHaveLength(5);

      // An hour after the first request, one slot is free again.
      jest.setSystemTime(new Date(start.getTime() + 60 * MINUTE + 1000));
      expect((await forgot(user.email)).status).toBe(200);
      tooSoon(await forgot(user.email));
    });

    it("applies the hourly limit to unknown emails too", async () => {
      fakeClock(new Date("2026-10-19T08:00:00Z"));
      const email = uniqueEmail("nobody");
      for (let i = 0; i < 5; i += 1) {
        if (i > 0) advance(61 * 1000);
        expect((await forgot(email)).status).toBe(200);
      }
      advance(61 * 1000);
      tooSoon(await forgot(email));
    });

    it("keeps each email's budget separate", async () => {
      fakeClock(new Date("2026-10-19T08:00:00Z"));
      const a = uniqueEmail("a");
      const b = uniqueEmail("b");
      expect((await forgot(a)).status).toBe(200);
      expect((await forgot(b)).status).toBe(200);
    });

    it("answers the throttle message in Arabic", async () => {
      fakeClock(new Date("2026-10-19T08:00:00Z"));
      const email = uniqueEmail("nobody");
      await forgot(email);
      const res = await forgot(email, "ar");
      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        code: "AUTH_OTP_RESEND_TOO_SOON",
        message: MESSAGES.AUTH_OTP_RESEND_TOO_SOON.ar,
      });
    });
  });

  it("a new code makes the previous one stop working", async () => {
    fakeClock(new Date("2026-10-19T08:00:00Z"));
    const { user } = await createPerson();
    await forgot(user.email);
    const first = lastCode(user.email);

    advance(61 * 1000);
    await forgot(user.email);
    const second = lastCode(user.email);
    expect(mailsTo(user.email)).toHaveLength(2);

    const rows = await otpRowsOf(user.id);
    expect(rows).toHaveLength(2);
    expect(rows[0].consumed_at).not.toBeNull();
    expect(rows[1].consumed_at).toBeNull();

    if (first !== second) {
      const old = await verify(user.email, first);
      expect(old.status).toBe(400);
      expect(old.body).toEqual(errorBody("AUTH_OTP_INVALID"));
    }
    const res = await verify(user.email, second);
    expect(res.status).toBe(200);
  });
});

// ---------- POST /auth/verify-otp ----------

describe("POST /api/auth/verify-otp", () => {
  it("returns a reset token for the correct code, stored only as a hash and valid for 15 minutes", async () => {
    const start = new Date("2026-10-19T08:00:00Z");
    fakeClock(start);
    const { user } = await createPerson();
    await forgot(user.email);

    advance(2 * MINUTE);
    const res = await verify(user.email, lastCode(user.email));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { resetToken: expect.any(String) } });
    const token = res.body.data.resetToken;
    expect(token.length).toBeGreaterThanOrEqual(43);

    const [row] = await otpRowsOf(user.id);
    expect(row.reset_token_hash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
    expect(new Date(row.reset_token_expires_at).getTime()).toBe(start.getTime() + 2 * MINUTE + 15 * MINUTE);
  });

  it("accepts the email in any case", async () => {
    const { user } = await createPerson();
    await forgot(user.email);
    const res = await verify(user.email.toUpperCase(), lastCode(user.email));
    expect(res.status).toBe(200);
  });

  it("can be used once: the same code again → AUTH_OTP_INVALID", async () => {
    const { user } = await createPerson();
    await forgot(user.email);
    const code = lastCode(user.email);
    expect((await verify(user.email, code)).status).toBe(200);
    const again = await verify(user.email, code);
    expect(again.status).toBe(400);
    expect(again.body).toEqual(errorBody("AUTH_OTP_INVALID"));
  });

  it("a wrong code → 400 AUTH_OTP_INVALID and counts one attempt", async () => {
    const { user } = await createPerson();
    await forgot(user.email);
    const res = await verify(user.email, wrongCodeFor(lastCode(user.email)));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_OTP_INVALID"));
    expect(res.body.message).toBe("This code is incorrect or has expired. Please try again.");
    const [row] = await otpRowsOf(user.id);
    expect(row.attempts).toBe(1);
  });

  it("four wrong codes then the right one works", async () => {
    const { user } = await createPerson();
    await forgot(user.email);
    const code = lastCode(user.email);
    for (let i = 0; i < 4; i += 1) {
      const res = await verify(user.email, wrongCodeFor(code));
      expect(res.status).toBe(400);
      expect(res.body).toEqual(errorBody("AUTH_OTP_INVALID"));
    }
    const ok = await verify(user.email, code);
    expect(ok.status).toBe(200);
    expect(ok.body.data.resetToken).toEqual(expect.any(String));
  });

  it("the fifth wrong code → 400 AUTH_OTP_ATTEMPTS_EXCEEDED and the correct code no longer works", async () => {
    const { user } = await createPerson();
    await forgot(user.email);
    const code = lastCode(user.email);
    for (let i = 0; i < 4; i += 1) await verify(user.email, wrongCodeFor(code));

    const fifth = await verify(user.email, wrongCodeFor(code));
    expect(fifth.status).toBe(400);
    expect(fifth.body).toEqual(errorBody("AUTH_OTP_ATTEMPTS_EXCEEDED"));
    expect(fifth.body.message).toBe("Too many incorrect attempts. Please request a new code.");

    const [row] = await otpRowsOf(user.id);
    expect(row.attempts).toBe(5);
    expect(row.consumed_at).not.toBeNull();

    const right = await verify(user.email, code);
    expect(right.status).toBe(400);
    expect(right.body).toEqual(errorBody("AUTH_OTP_INVALID"));
  });

  it("a new code after too many attempts works again", async () => {
    fakeClock(new Date("2026-10-19T08:00:00Z"));
    const { user } = await createPerson();
    await forgot(user.email);
    const code = lastCode(user.email);
    for (let i = 0; i < 5; i += 1) await verify(user.email, wrongCodeFor(code));

    advance(61 * 1000);
    await forgot(user.email);
    expect((await verify(user.email, lastCode(user.email))).status).toBe(200);
  });

  it("a code older than 10 minutes → AUTH_OTP_INVALID (works just before)", async () => {
    const start = new Date("2026-10-19T08:00:00Z");
    fakeClock(start);
    const a = (await createPerson()).user;
    const b = (await createPerson()).user;
    await forgot(a.email);
    await forgot(b.email);

    jest.setSystemTime(new Date(start.getTime() + 10 * MINUTE - 1000));
    expect((await verify(a.email, lastCode(a.email))).status).toBe(200);

    jest.setSystemTime(new Date(start.getTime() + 10 * MINUTE + 1000));
    const late = await verify(b.email, lastCode(b.email));
    expect(late.status).toBe(400);
    expect(late.body).toEqual(errorBody("AUTH_OTP_INVALID"));
    const [row] = await otpRowsOf(b.id);
    expect(row.attempts).toBe(0);
  });

  it("an unknown email → AUTH_OTP_INVALID", async () => {
    const res = await verify(uniqueEmail("nobody"), "123456");
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_OTP_INVALID"));
  });

  it("a known email that never asked for a code → AUTH_OTP_INVALID", async () => {
    const { user } = await createPerson();
    const res = await verify(user.email, "123456");
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("AUTH_OTP_INVALID"));
  });

  it("answers in Arabic when asked", async () => {
    const res = await verify(uniqueEmail("nobody"), "123456", "ar");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: "AUTH_OTP_INVALID", message: MESSAGES.AUTH_OTP_INVALID.ar });
  });

  it("answers attempts exceeded in Arabic when asked", async () => {
    const { user } = await createPerson();
    await forgot(user.email);
    const code = lastCode(user.email);
    for (let i = 0; i < 4; i += 1) await verify(user.email, wrongCodeFor(code));
    const res = await verify(user.email, wrongCodeFor(code), "ar");
    expect(res.body).toEqual({
      success: false,
      code: "AUTH_OTP_ATTEMPTS_EXCEEDED",
      message: MESSAGES.AUTH_OTP_ATTEMPTS_EXCEEDED.ar,
    });
  });

  describe("validation", () => {
    it.each([
      ["missing", {}],
      ["empty", { otp: "" }],
      ["too short", { otp: "12345" }],
      ["too long", { otp: "1234567" }],
      ["not digits", { otp: "12a456" }],
      ["a number", { otp: 123456 }],
    ])("otp %s → 400 'Please enter complete OTP'", async (_label, body) => {
      const res = await post("verify-otp", { email: uniqueEmail("x"), ...body });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ otp: "Please enter complete OTP" }));
    });

    it("checks the email like Login, reporting every bad field", async () => {
      const res = await post("verify-otp", { email: "bad" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ email: "Invalid email address", otp: "Please enter complete OTP" }));
    });

    it("answers the otp message in Arabic", async () => {
      const res = await post("verify-otp", { email: uniqueEmail("x") }, "ar");
      expect(res.body.errors).toEqual({ otp: FIELD_MESSAGES.otpIncomplete.ar });
    });
  });
});

// ---------- POST /auth/reset-password ----------

describe("POST /api/auth/reset-password", () => {
  describe("success", () => {
    it("saves the new password: it logs in, the old one doesn't", async () => {
      const { user } = await createPerson();
      const token = await resetTokenFor(user.email);

      const res = await reset(resetBody(token));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
      const old = await login(user.email, PASSWORD);
      expect(old.status).toBe(401);
      expect(old.body).toEqual(errorBody("AUTH_INVALID_CREDENTIALS"));

      const stored = await db.User.scope("withPassword").findByPk(user.id);
      expect(stored.password).toMatch(/^\$2[aby]\$12\$/);
      expect(stored.password).not.toContain(NEW_PASSWORD);
    });

    it("ends every existing session of the person, on every login", async () => {
      const { user, account } = await createPerson();
      // A second (ended) login of the same person at another company with a live session.
      const other = await build(db, "Employer", { company_name: "Other Co" });
      const oldAccount = await db.HrmsAccount.create({
        user_id: user.id,
        employer_id: other.id,
        access_level: "EMPLOYEE",
        status: "INACTIVE",
        password_setup_required: false,
      });
      const oldSession = await build(db, "HrmsSession", { hrms_account_id: oldAccount.id, status: "ACTIVE" });

      const first = await login(user.email);
      const second = await login(user.email);
      const cookies = [cookiePair(first), cookiePair(second)];

      const token = await resetTokenFor(user.email);
      expect((await reset(resetBody(token))).status).toBe(200);

      for (const cookie of cookies) {
        const res = await refresh(cookie);
        expect(res.status).toBe(401);
        expect(res.body).toEqual(errorBody("AUTH_REFRESH_INVALID"));
      }
      const active = await db.HrmsSession.count({
        where: { hrms_account_id: [account.id, oldAccount.id], status: "ACTIVE" },
      });
      expect(active).toBe(0);
      await oldSession.reload();
      expect(oldSession.status).toBe("REVOKED");

      // The old access token no longer works either.
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${first.body.data.accessToken}`);
      expect(me.status).toBe(401);
    });

    it("unlocks a locked person and clears the failed-attempt count", async () => {
      const { user } = await createPerson({
        user: { failed_login_attempts: 5, locked_until: new Date(Date.now() + 10 * MINUTE) },
      });
      expect((await login(user.email)).status).toBe(423);

      const token = await resetTokenFor(user.email);
      expect((await reset(resetBody(token))).status).toBe(200);

      await user.reload();
      expect(user.failed_login_attempts).toBe(0);
      expect(user.locked_until).toBeNull();
      expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
    });

    it("uses up the code and the token", async () => {
      const { user } = await createPerson();
      const token = await resetTokenFor(user.email);
      await reset(resetBody(token));
      const [row] = await otpRowsOf(user.id);
      expect(row.consumed_at).not.toBeNull();
      expect(row.reset_token_hash).toBeNull();
    });
  });

  describe("bad token", () => {
    const invalid = (res) => {
      expect(res.status).toBe(400);
      expect(res.body).toEqual(errorBody("AUTH_RESET_TOKEN_INVALID"));
      expect(res.body.message).toBe("Your reset session has expired. Please start again.");
    };

    it("reusing the token → AUTH_RESET_TOKEN_INVALID", async () => {
      const { user } = await createPerson();
      const token = await resetTokenFor(user.email);
      expect((await reset(resetBody(token))).status).toBe(200);
      invalid(await reset(resetBody(token, { newPassword: "Another#2026", confirmPassword: "Another#2026" })));
      expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
    });

    it("works just before 15 minutes; after 15 minutes → AUTH_RESET_TOKEN_INVALID", async () => {
      const start = new Date("2026-10-19T08:00:00Z");
      fakeClock(start);
      const a = (await createPerson()).user;
      const b = (await createPerson()).user;
      const tokenA = await resetTokenFor(a.email);
      const tokenB = await resetTokenFor(b.email);

      jest.setSystemTime(new Date(start.getTime() + 15 * MINUTE - 1000));
      expect((await reset(resetBody(tokenA))).status).toBe(200);

      jest.setSystemTime(new Date(start.getTime() + 15 * MINUTE + 1000));
      invalid(await reset(resetBody(tokenB)));
      expect((await login(b.email, PASSWORD)).status).toBe(200);
    });

    it.each([
      ["unknown", "not-a-real-token"],
      ["empty", ""],
    ])("an %s token → AUTH_RESET_TOKEN_INVALID", async (_label, token) => {
      invalid(await reset(resetBody(token)));
    });

    it("a missing token → AUTH_RESET_TOKEN_INVALID", async () => {
      invalid(await reset({ newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }));
    });

    it("a token from before a newer code was requested → AUTH_RESET_TOKEN_INVALID", async () => {
      fakeClock(new Date("2026-10-19T08:00:00Z"));
      const { user } = await createPerson();
      const token = await resetTokenFor(user.email);
      advance(61 * 1000);
      await forgot(user.email);
      invalid(await reset(resetBody(token)));
    });

    it("answers in Arabic when asked", async () => {
      const res = await reset(resetBody("nope"), "ar");
      expect(res.body).toEqual({
        success: false,
        code: "AUTH_RESET_TOKEN_INVALID",
        message: MESSAGES.AUTH_RESET_TOKEN_INVALID.ar,
      });
    });
  });

  describe("new password checks", () => {
    let user;
    let token;
    beforeEach(async () => {
      ({ user } = await createPerson());
      token = await resetTokenFor(user.email);
    });

    it.each([
      ["too short", "Ab1!xyz"],
      ["too long", `Ab1!${"x".repeat(69)}`],
      ["no uppercase", "abcdef1!"],
      ["no lowercase", "ABCDEF1!"],
      ["no digit", "Abcdefg!"],
      ["no special character", "Abcdefg1"],
    ])("a weak password (%s) → the password-rule message", async (_label, weak) => {
      const res = await reset(resetBody(token, { newPassword: weak, confirmPassword: weak }));
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ newPassword: WEAK }));
    });

    it("a missing new password → 'Password is required'", async () => {
      const res = await reset({ resetToken: token, confirmPassword: NEW_PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.errors.newPassword).toBe("Password is required");
    });

    it("a missing confirmation → 'Please confirm your password'", async () => {
      const res = await reset({ resetToken: token, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ confirmPassword: "Please confirm your password" }));
    });

    it("a different confirmation → 'Passwords do not match'", async () => {
      const res = await reset(resetBody(token, { confirmPassword: "Different#2026" }));
      expect(res.status).toBe(400);
      expect(res.body).toEqual(validationBody({ confirmPassword: "Passwords do not match" }));
    });

    it("the current password again → AUTH_PASSWORD_SAME under newPassword", async () => {
      const res = await reset(resetBody(token, { newPassword: PASSWORD, confirmPassword: PASSWORD }));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ...errorBody("AUTH_PASSWORD_SAME"),
        errors: { newPassword: "New password must be different from your current one." },
      });
    });

    it("leaves the password and the token untouched after a failed check, so the person can retry", async () => {
      await reset(resetBody(token, { newPassword: PASSWORD, confirmPassword: PASSWORD }));
      await reset(resetBody(token, { confirmPassword: "Different#2026" }));
      expect((await login(user.email, PASSWORD)).status).toBe(200);
      expect((await reset(resetBody(token))).status).toBe(200);
    });

    it("answers field messages in Arabic", async () => {
      const res = await reset(resetBody(token, { newPassword: "weak", confirmPassword: "other" }), "ar");
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual({
        newPassword: MESSAGES.AUTH_PASSWORD_WEAK.ar,
        confirmPassword: MESSAGES.AUTH_PASSWORD_MISMATCH.ar,
      });
    });

    it("answers the same-password message in Arabic", async () => {
      const res = await reset(resetBody(token, { newPassword: PASSWORD, confirmPassword: PASSWORD }), "ar");
      expect(res.body).toEqual({
        success: false,
        code: "AUTH_PASSWORD_SAME",
        message: MESSAGES.AUTH_PASSWORD_SAME.ar,
        errors: { newPassword: MESSAGES.AUTH_PASSWORD_SAME.ar },
      });
    });
  });
});

// ---------- rate limits (D11) ----------

describe("rate limits", () => {
  const limitedApp = () => {
    const limited = express();
    limited.use(language);
    limited.use(express.json());
    limited.use(cookieParser());
    limited.use("/api/auth", createAuthRouter({ windowMs: 60 * 1000, authMax: 10, refreshMax: 60 }));
    limited.use(errorHandler);
    return limited;
  };

  it.each(["forgot-password", "verify-otp", "reset-password"])(
    "gives the 11th %s request within a minute from one IP 429 RATE_LIMITED",
    async (path) => {
      const limited = limitedApp();
      for (let i = 0; i < 10; i += 1) {
        const res = await request(limited).post(`/api/auth/${path}`).send({});
        expect(res.status).toBe(400);
      }
      const eleventh = await request(limited).post(`/api/auth/${path}`).send({});
      expect(eleventh.status).toBe(429);
      expect(eleventh.body).toEqual(errorBody("RATE_LIMITED"));
    }
  );
});
