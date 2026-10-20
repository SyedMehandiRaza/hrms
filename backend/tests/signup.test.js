const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const { seedId } = require("../src/utils/seed");
const { build } = require("./helpers/factory");
const language = require("../src/middlewares/language");
const errorHandler = require("../src/middlewares/errorHandler");
const { createAuthRouter } = require("../src/routes/auth.routes");
const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");

const PASSWORD = "Test@12345";
const NEW_PASSWORD = "Signup#2026";
const COOKIE = "refresh_token";
const WEAK = MESSAGES.AUTH_PASSWORD_WEAK.en;

const errorBody = (code) => ({ success: false, code, message: MESSAGES[code].en });
const uniqueEmail = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}@hrms.test`;

let passwordHash;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  for (const [key, name] of [
    ["department", "Departments"],
    ["designation", "Designations"],
  ]) {
    await db.Module.findOrCreate({ where: { module_key: key }, defaults: { name } });
  }
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  await db.sequelize.close();
});

// ---------- helpers ----------

const validBody = (overrides = {}) => ({
  companyName: "Desert Rose Trading",
  name: "Fatima Al-Qahtani",
  email: uniqueEmail("owner"),
  phone: "0501234567",
  phoneCountry: "SA",
  password: NEW_PASSWORD,
  confirmPassword: NEW_PASSWORD,
  ...overrides,
});

const signup = (body, lang) => {
  const req = request(app).post("/api/auth/signup");
  if (lang) req.set("Accept-Language", lang);
  return req.send(body);
};

const me = (token) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

const setCookieOf = (res) => (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));

// An existing company with its owner and a login of the given access level.
const createCompany = async () => {
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: passwordHash });
  const employer = await build(db, "Employer", { user_id: owner.id, company_name: "Al Noor Construction" });
  await db.CompanyTimeSetting.create({ employer_id: employer.id, timezone: "Asia/Riyadh" });
  const ownerAccount = await db.HrmsAccount.create({
    user_id: owner.id,
    employer_id: employer.id,
    access_level: "ADMIN",
    password_setup_required: false,
  });
  return { owner, employer, ownerAccount };
};

const createPerson = (overrides = {}) =>
  db.User.create({ name: "Omar Saleh", email: uniqueEmail("person"), password: passwordHash, ...overrides });

const createAccount = (user, employer, overrides = {}) =>
  db.HrmsAccount.create({
    user_id: user.id,
    employer_id: employer.id,
    access_level: "EMPLOYEE",
    password_setup_required: false,
    ...overrides,
  });

// Every row the sign up would have written for this email.
const rowsFor = async (email) => {
  const user = await db.User.findOne({ where: { email }, paranoid: false });
  if (!user) return { user: null, employers: 0, accounts: 0 };
  return {
    user,
    employers: await db.Employer.count({ where: { user_id: user.id }, paranoid: false }),
    accounts: await db.HrmsAccount.count({ where: { user_id: user.id }, paranoid: false }),
  };
};

const riyadhYear = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", year: "numeric" }).format(new Date()));

// ---------- POST /auth/signup ----------

describe("POST /api/auth/signup", () => {
  describe("success", () => {
    let body;
    let res;

    beforeAll(async () => {
      body = validBody();
      res = await signup(body);
    });

    it("answers 201 with an access token, mustChangePassword false and the current user", async () => {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.accessToken).toBe("string");
      expect(res.body.data.mustChangePassword).toBe(false);

      const user = await db.User.findOne({ where: { email: body.email } });
      const employer = await db.Employer.findOne({ where: { user_id: user.id } });
      const account = await db.HrmsAccount.findOne({ where: { user_id: user.id } });

      expect(res.body.data.me).toMatchObject({
        user: { id: user.id, name: "Fatima Al-Qahtani", email: body.email, lang_key: "EN" },
        account: { id: account.id, access_level: "ADMIN", panel: "admin" },
        company: {
          id: employer.id,
          name: "Desert Rose Trading",
          logo: null,
          timezone: "Asia/Riyadh",
          currency: "SAR",
          country: { id: seedId("country:SA"), iso2: "SA", name: "Saudi Arabia", callingCode: "+966" },
        },
        mustChangePassword: false,
      });
      expect(res.body.data.me.permissions.department).toEqual({ read: true, create: true, update: true, delete: true });

      const payload = jwt.verify(res.body.data.accessToken, process.env.JWT_ACCESS_SECRET);
      expect(payload).toMatchObject({ sub: user.id, acc: account.id, emp: employer.id });
    });

    it("sets the same strict httpOnly refresh cookie as login and stores a session", async () => {
      const cookie = setCookieOf(res);
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/auth(;|$)/);
      expect(cookie).toMatch(/Max-Age=604800/);

      const { sid, acc } = jwt.decode(res.body.data.accessToken);
      const session = await db.HrmsSession.findByPk(sid);
      expect(session.status).toBe("ACTIVE");
      expect(session.hrms_account_id).toBe(acc);
    });

    it("the token works: /auth/me shows the owner panel, the new company, Asia/Riyadh and SAR", async () => {
      const meRes = await me(res.body.data.accessToken);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data).toEqual(res.body.data.me);
    });

    it("the refresh cookie works", async () => {
      const cookie = setCookieOf(res).split(";")[0];
      const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
      expect(refreshed.status).toBe(200);
    });

    it("creates the person, company, time settings, one OPEN financial year and the ADMIN account; no roles", async () => {
      const user = await db.User.scope("withPassword").findOne({ where: { email: body.email } });
      expect(user.name).toBe("Fatima Al-Qahtani");
      expect(user.user_status).toBe("ACTIVE");
      expect(await bcrypt.compare(NEW_PASSWORD, user.password)).toBe(true);
      expect(user.password).toMatch(/^\$2[aby]\$12\$/);
      expect(user.phone_number).toBeNull();

      const employer = await db.Employer.findOne({ where: { user_id: user.id } });
      expect(employer.company_name).toBe("Desert Rose Trading");
      expect(employer.employer_status).toBe("ACTIVE");
      expect(employer.company_phone_number).toBe("+966501234567");
      expect(employer.phone_country).toBe("SA");
      expect(employer.country_id).toBe(seedId("country:SA"));
      expect(employer.company_email).toBeNull();

      const settings = await db.CompanyTimeSetting.findAll({ where: { employer_id: employer.id } });
      expect(settings).toHaveLength(1);
      expect(settings[0].timezone).toBe("Asia/Riyadh");
      expect(settings[0].fy_start_month).toBe(1);

      const years = await db.FinancialYear.findAll({ where: { employer_id: employer.id } });
      expect(years).toHaveLength(1);
      const year = riyadhYear();
      expect(years[0]).toMatchObject({
        year_key: year,
        label: `FY ${year}`,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        status: "OPEN",
        is_locked: false,
      });
      expect(years[0].opened_at).not.toBeNull();
      expect(Date.now() - new Date(years[0].opened_at)).toBeLessThan(60000);

      const accounts = await db.HrmsAccount.findAll({ where: { user_id: user.id } });
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        employer_id: employer.id,
        access_level: "ADMIN",
        status: "ACTIVE",
        role_id: null,
        password_setup_required: false,
      });
      expect(accounts[0].password_set_at).not.toBeNull();
      expect(accounts[0].last_login_at).not.toBeNull();

      expect(await db.Role.count({ where: { employer_id: employer.id } })).toBe(0);
    });

    it("never returns a password field", () => {
      expect(JSON.stringify(res.body)).not.toMatch(/"password"/i);
      expect(JSON.stringify(res.body)).not.toContain(NEW_PASSWORD);
    });
  });

  it("stores the email trimmed and lowercased, and trims the names", async () => {
    const email = uniqueEmail("MixedCase").toUpperCase();
    const res = await signup(validBody({ email: `  ${email}  `, companyName: "  Red Sea Co  ", name: "  Ali  " }));
    expect(res.status).toBe(201);
    const user = await db.User.findOne({ where: { email: email.toLowerCase() } });
    expect(user.email).toBe(email.toLowerCase());
    expect(user.name).toBe("Ali");
    const employer = await db.Employer.findOne({ where: { user_id: user.id } });
    expect(employer.company_name).toBe("Red Sea Co");
  });

  it("the new owner can log in with the email and password", async () => {
    const body = validBody();
    expect((await signup(body)).status).toBe(201);
    const res = await request(app).post("/api/auth/login").send({ email: body.email, password: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(false);
  });

  it("phone is optional (missing or empty) and then not stored", async () => {
    const { phone, ...withoutPhone } = validBody();
    expect(phone).toBeDefined();
    const res = await signup(withoutPhone);
    expect(res.status).toBe(201);

    const res2 = await signup(validBody({ phone: "", phoneCountry: "" }));
    expect(res2.status).toBe(201);

    const res3 = await signup(validBody({ phone: null, phoneCountry: null }));
    expect(res3.status).toBe(201);

    for (const r of [res, res2, res3]) {
      const employer = await db.Employer.findByPk(jwt.decode(r.body.data.accessToken).emp);
      expect(employer.company_phone_number).toBeNull();
      expect(employer.phone_country).toBeNull();
    }
  });

  it("stores any valid number of the chosen phone country as E.164 (local, international, landline, other country)", async () => {
    const cases = [
      [{ phone: "50 123 4567", phoneCountry: "SA" }, "+966501234567", "SA"],
      [{ phone: "+966 50 123 4567", phoneCountry: "sa" }, "+966501234567", "SA"],
      [{ phone: "011 234 5678", phoneCountry: "SA" }, "+966112345678", "SA"],
      [{ phone: "98765 43210", phoneCountry: "IN" }, "+919876543210", "IN"],
    ];
    for (const [phone, e164, country] of cases) {
      const res = await signup(validBody(phone));
      expect(res.status).toBe(201);
      const employer = await db.Employer.findByPk(jwt.decode(res.body.data.accessToken).emp);
      expect([employer.company_phone_number, employer.phone_country]).toEqual([e164, country]);
    }
  });

  it("accepts names and company names of exactly 2 and 100 characters", async () => {
    expect((await signup(validBody({ name: "Al", companyName: "AB" }))).status).toBe(201);
    expect((await signup(validBody({ name: "n".repeat(100), companyName: "c".repeat(100) }))).status).toBe(201);
  });

  it("accepts passwords of exactly 8 and 72 characters", async () => {
    const p8 = "Aa1!aaaa";
    expect((await signup(validBody({ password: p8, confirmPassword: p8 }))).status).toBe(201);
    const p72 = `Aa1!${"a".repeat(68)}`;
    expect(p72).toHaveLength(72);
    expect((await signup(validBody({ password: p72, confirmPassword: p72 }))).status).toBe(201);
  });

  // ---------- validation ----------

  describe("validation", () => {
    const expectFieldErrors = async (body, errors, lang) => {
      const res = await signup(body, lang);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(res.body.message).toBe(lang === "ar" ? MESSAGES.VALIDATION_FAILED.ar : MESSAGES.VALIDATION_FAILED.en);
      expect(res.body.errors).toEqual(errors);
      return res;
    };

    it("an empty body reports every required field at once", async () => {
      await expectFieldErrors(
        {},
        {
          companyName: "Company name is required",
          name: "Your name is required",
          email: "Email is required",
          password: WEAK,
          confirmPassword: "Please confirm your password",
        }
      );
    });

    it("empty strings and blanks count as missing", async () => {
      await expectFieldErrors(
        { companyName: "   ", name: "", email: " ", password: "", confirmPassword: "" },
        {
          companyName: "Company name is required",
          name: "Your name is required",
          email: "Email is required",
          password: WEAK,
          confirmPassword: "Please confirm your password",
        }
      );
    });

    it("companyName: min 2 and max 100 characters", async () => {
      await expectFieldErrors(validBody({ companyName: " A " }), {
        companyName: "Company name must be at least 2 characters",
      });
      await expectFieldErrors(validBody({ companyName: "c".repeat(101) }), {
        companyName: "Company name cannot exceed 100 characters",
      });
    });

    it("name: min 2 and max 100 characters", async () => {
      await expectFieldErrors(validBody({ name: "A" }), { name: "Name must be at least 2 characters" });
      await expectFieldErrors(validBody({ name: "n".repeat(101) }), { name: "Name cannot exceed 100 characters" });
    });

    it("email: must be valid", async () => {
      await expectFieldErrors(validBody({ email: "not-an-email" }), { email: "Invalid email address" });
    });

    it("phone: a valid number of its phone country", async () => {
      for (const phone of ["12345", "1234567890123456", "+919876543210", "abcdefg"]) {
        await expectFieldErrors(validBody({ phone }), { phone: "Enter a valid phone number for the selected country." });
      }
    });

    it("phoneCountry: required with a phone, and a known country", async () => {
      await expectFieldErrors(validBody({ phoneCountry: undefined }), { phoneCountry: "Select the phone number's country." });
      await expectFieldErrors(validBody({ phoneCountry: "" }), { phoneCountry: "Select the phone number's country." });
      await expectFieldErrors(validBody({ phoneCountry: "ZZ" }), { phoneCountry: "Select the phone number's country." });
    });

    it("password: 8–72 characters with upper, lower, digit and special character", async () => {
      const weak = [
        "Aa1!aaa", // 7 characters
        `Aa1!${"a".repeat(69)}`, // 73 characters
        "aa1!aaaa", // no uppercase
        "AA1!AAAA", // no lowercase
        "Aa!aaaaa", // no digit
        "Aa1aaaaa", // no special character
      ];
      for (const password of weak) {
        await expectFieldErrors(validBody({ password, confirmPassword: password }), { password: WEAK });
      }
    });

    it("confirmPassword: required and must match", async () => {
      await expectFieldErrors(validBody({ confirmPassword: undefined }), {
        confirmPassword: "Please confirm your password",
      });
      await expectFieldErrors(validBody({ confirmPassword: "Other#2026x" }), { confirmPassword: "Passwords do not match" });
    });

    it("non-string values are rejected under their fields", async () => {
      await expectFieldErrors(
        { companyName: 12, name: true, email: 5, phone: 123456, password: 12345678, confirmPassword: 12345678 },
        {
          companyName: "Company name is required",
          name: "Your name is required",
          email: "Email is required",
          phone: "Enter a valid phone number for the selected country.",
          phoneCountry: "Select the phone number's country.",
          password: WEAK,
          confirmPassword: "Please confirm your password",
        }
      );
    });

    it("answers in Arabic when asked", async () => {
      await expectFieldErrors(
        {},
        {
          companyName: FIELD_MESSAGES.companyNameRequired.ar,
          name: FIELD_MESSAGES.nameRequired.ar,
          email: FIELD_MESSAGES.emailRequired.ar,
          password: MESSAGES.AUTH_PASSWORD_WEAK.ar,
          confirmPassword: FIELD_MESSAGES.confirmPasswordRequired.ar,
        },
        "ar"
      );
    });

    it("writes nothing when validation fails", async () => {
      const body = validBody({ name: "A" });
      await signup(body);
      expect((await rowsFor(body.email)).user).toBeNull();
    });
  });

  // ---------- existing email (ADR 0002) ----------

  describe("an email that is already registered", () => {
    let company;
    beforeAll(async () => {
      company = await createCompany();
    });

    const expectTaken = async (email, password = PASSWORD) => {
      const res = await signup(validBody({ email, password, confirmPassword: password }));
      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("AUTH_EMAIL_TAKEN"));
      expect(res.body.message).toBe("An account with this email already exists. Log in or reset your password.");
      expect(setCookieOf(res)).toBeUndefined();
      return res;
    };

    it("a company owner's email → 409 AUTH_EMAIL_TAKEN, even with the right password", async () => {
      await expectTaken(company.owner.email);
      expect(await db.Employer.count({ where: { user_id: company.owner.id } })).toBe(1);
    });

    it("matches the email in any case and with spaces", async () => {
      await expectTaken(`  ${company.owner.email.toUpperCase()}  `);
    });

    it("a person with an ACTIVE account → 409", async () => {
      const person = await createPerson();
      await createAccount(person, company.employer);
      await expectTaken(person.email);
      expect((await rowsFor(person.email)).accounts).toBe(1);
    });

    it("a person with a SUSPENDED account → 409", async () => {
      const person = await createPerson();
      await createAccount(person, company.employer, { status: "SUSPENDED" });
      await expectTaken(person.email);
    });

    it("a current account next to ended ones still blocks", async () => {
      const other = await createCompany();
      const person = await createPerson();
      await createAccount(person, company.employer, { status: "INACTIVE" });
      await createAccount(person, other.employer, { status: "ACTIVE" });
      await expectTaken(person.email);
    });

    it("answers the 409 in Arabic when asked", async () => {
      const res = await signup(validBody({ email: company.owner.email, password: PASSWORD, confirmPassword: PASSWORD }), "ar");
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: "AUTH_EMAIL_TAKEN", message: MESSAGES.AUTH_EMAIL_TAKEN.ar });
    });

    describe("only ended accounts (INACTIVE or deleted)", () => {
      it("with the person's existing password → 201 and the same person record is reused", async () => {
        const person = await createPerson({ name: "Omar Saleh", phone_number: "0555000111" });
        await createAccount(person, company.employer, { status: "INACTIVE" });

        const res = await signup(validBody({ email: person.email, password: PASSWORD, confirmPassword: PASSWORD }));
        expect(res.status).toBe(201);
        expect(res.body.data.me.user.id).toBe(person.id);
        expect(res.body.data.me.account.access_level).toBe("ADMIN");

        expect(await db.User.count({ where: { email: person.email }, paranoid: false })).toBe(1);
        const reloaded = await db.User.scope("withPassword").findByPk(person.id);
        expect(reloaded.password).toBe(passwordHash); // password unchanged
        expect(reloaded.phone_number).toBe("0555000111");

        const accounts = await db.HrmsAccount.findAll({ where: { user_id: person.id }, order: [["created_at", "ASC"]] });
        expect(accounts).toHaveLength(2);
        const newAccount = accounts.find((a) => a.employer_id !== company.employer.id);
        expect(newAccount).toMatchObject({ access_level: "ADMIN", status: "ACTIVE" });
        const employer = await db.Employer.findByPk(newAccount.employer_id);
        expect(employer.user_id).toBe(person.id);

        // The old company's account is untouched.
        const oldAccount = accounts.find((a) => a.employer_id === company.employer.id);
        expect(oldAccount.status).toBe("INACTIVE");
      });

      it("a soft-deleted account counts as ended", async () => {
        const person = await createPerson();
        const account = await createAccount(person, company.employer);
        await account.destroy();
        const res = await signup(validBody({ email: person.email, password: PASSWORD, confirmPassword: PASSWORD }));
        expect(res.status).toBe(201);
        expect(res.body.data.me.user.id).toBe(person.id);
      });

      it("with any other password → the same 409 and nothing is written", async () => {
        const person = await createPerson();
        await createAccount(person, company.employer, { status: "INACTIVE" });
        await expectTaken(person.email, NEW_PASSWORD);
        const rows = await rowsFor(person.email);
        expect(rows.employers).toBe(0);
        expect(rows.accounts).toBe(1);
      });

      it("a person without a password can't prove it → 409", async () => {
        const person = await createPerson({ password: null });
        await createAccount(person, company.employer, { status: "INACTIVE" });
        await expectTaken(person.email, NEW_PASSWORD);
      });

      // D19: a wrong existing password counts toward the login lockout (D10) exactly like login.
      describe("wrong existing password counts toward the lockout (D19)", () => {
        const LOCK_MS = 15 * 60 * 1000;
        const endedPerson = async (overrides) => {
          const person = await createPerson(overrides);
          await createAccount(person, company.employer, { status: "INACTIVE" });
          return person;
        };
        const reload = (person) => db.User.findByPk(person.id);
        const signupWith = (email, password, lang) => signup(validBody({ email, password, confirmPassword: password }), lang);
        const expectLocked = (res) => {
          expect(res.status).toBe(423);
          expect(res.body).toEqual(errorBody("AUTH_ACCOUNT_LOCKED"));
          expect(setCookieOf(res)).toBeUndefined();
        };

        it("each wrong password below the limit → 409 and adds one to the count", async () => {
          const person = await endedPerson();
          for (let i = 1; i <= 4; i += 1) {
            await expectTaken(person.email, NEW_PASSWORD);
            expect((await reload(person)).failed_login_attempts).toBe(i);
          }
          expect((await reload(person)).locked_until).toBeNull();
        });

        it("the fifth consecutive wrong password → 423 AUTH_ACCOUNT_LOCKED for 15 minutes, nothing written", async () => {
          const person = await endedPerson({ failed_login_attempts: 4 });
          const before = Date.now();

          const res = await signupWith(person.email, NEW_PASSWORD);

          expectLocked(res);
          expect(res.body.message).toBe(MESSAGES.AUTH_ACCOUNT_LOCKED.en);
          const reloaded = await reload(person);
          expect(reloaded.failed_login_attempts).toBe(5);
          const until = new Date(reloaded.locked_until).getTime();
          expect(until).toBeGreaterThanOrEqual(before + LOCK_MS - 1000);
          expect(until).toBeLessThanOrEqual(Date.now() + LOCK_MS + 1000);
          expect((await rowsFor(person.email)).employers).toBe(0);
        });

        it("counts together with wrong logins", async () => {
          jest.spyOn(console, "warn").mockImplementation(() => {});
          const person = await endedPerson();
          for (let i = 0; i < 4; i += 1) {
            await request(app).post("/api/auth/login").send({ email: person.email, password: NEW_PASSWORD });
          }
          expect((await reload(person)).failed_login_attempts).toBe(4);
          expectLocked(await signupWith(person.email, NEW_PASSWORD));
        });

        it("while locked → 423 even with the right password, and nothing is written", async () => {
          const person = await endedPerson({ failed_login_attempts: 5, locked_until: new Date(Date.now() + LOCK_MS) });

          expectLocked(await signupWith(person.email, PASSWORD));
          expectLocked(await signupWith(person.email, NEW_PASSWORD));

          const rows = await rowsFor(person.email);
          expect(rows.employers).toBe(0);
          expect(rows.accounts).toBe(1);
          expect((await reload(person)).failed_login_attempts).toBe(5);
        });

        it("answers the 423 in Arabic when asked", async () => {
          const person = await endedPerson({ failed_login_attempts: 5, locked_until: new Date(Date.now() + LOCK_MS) });
          const res = await signupWith(person.email, PASSWORD, "ar");
          expect(res.status).toBe(423);
          expect(res.body).toEqual({ success: false, code: "AUTH_ACCOUNT_LOCKED", message: MESSAGES.AUTH_ACCOUNT_LOCKED.ar });
        });

        it("the right password clears earlier failures and signs up", async () => {
          const person = await endedPerson({ failed_login_attempts: 3 });
          const res = await signupWith(person.email, PASSWORD);
          expect(res.status).toBe(201);
          const reloaded = await reload(person);
          expect(reloaded.failed_login_attempts).toBe(0);
          expect(reloaded.locked_until).toBeNull();
        });

        it("after the lock has passed the right password signs up and clears the lock", async () => {
          const person = await endedPerson({ failed_login_attempts: 5, locked_until: new Date(Date.now() - 1000) });
          const res = await signupWith(person.email, PASSWORD);
          expect(res.status).toBe(201);
          const reloaded = await reload(person);
          expect(reloaded.failed_login_attempts).toBe(0);
          expect(reloaded.locked_until).toBeNull();
        });

        it("a person with no accounts at all is counted the same way", async () => {
          const person = await createPerson({ failed_login_attempts: 4 });
          expectLocked(await signupWith(person.email, NEW_PASSWORD));
        });

        it("an email with a current account → 409 and nothing is counted", async () => {
          const person = await createPerson();
          await createAccount(person, company.employer);
          await expectTaken(person.email, NEW_PASSWORD);
          expect((await reload(person)).failed_login_attempts).toBe(0);
        });

        it("a company owner's email → 409 and nothing is counted", async () => {
          const other = await createCompany();
          await other.ownerAccount.update({ status: "INACTIVE" });
          await expectTaken(other.owner.email, NEW_PASSWORD);
          expect((await reload(other.owner)).failed_login_attempts).toBe(0);
        });
      });
    });

    describe("a person with no accounts at all (treated like ended accounts)", () => {
      it("with the existing password → 201, same person", async () => {
        const person = await createPerson();
        const res = await signup(validBody({ email: person.email, password: PASSWORD, confirmPassword: PASSWORD }));
        expect(res.status).toBe(201);
        expect(res.body.data.me.user.id).toBe(person.id);
      });

      it("with another password → 409", async () => {
        const person = await createPerson();
        await expectTaken(person.email, NEW_PASSWORD);
        expect((await rowsFor(person.email)).employers).toBe(0);
      });
    });

    it("a person who already owns a company (even with an ended account) → 409", async () => {
      const other = await createCompany();
      await other.ownerAccount.update({ status: "INACTIVE" });
      await expectTaken(other.owner.email);
      expect(await db.Employer.count({ where: { user_id: other.owner.id }, paranoid: false })).toBe(1);
    });

    it("a deleted or non-active person record → 409", async () => {
      const deleted = await createPerson();
      await deleted.destroy();
      await expectTaken(deleted.email);

      const blocked = await createPerson({ user_status: "BLOCKED" });
      await expectTaken(blocked.email);
    });
  });

  // ---------- atomicity ----------

  describe("if any step fails nothing is left behind", () => {
    beforeEach(() => {
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    it("a new person: no person, company, settings, year, account or session remain", async () => {
      const employersBefore = await db.Employer.count({ paranoid: false });
      const settingsBefore = await db.CompanyTimeSetting.count();
      const sessionsBefore = await db.HrmsSession.count();

      jest.spyOn(db.FinancialYear, "create").mockRejectedValueOnce(new Error("boom"));
      const body = validBody();
      const res = await signup(body);

      expect(res.status).toBe(500);
      expect(res.body).toEqual(errorBody("INTERNAL_ERROR"));
      expect(setCookieOf(res)).toBeUndefined();
      expect((await rowsFor(body.email)).user).toBeNull();
      expect(await db.Employer.count({ paranoid: false })).toBe(employersBefore);
      expect(await db.CompanyTimeSetting.count()).toBe(settingsBefore);
      expect(await db.HrmsSession.count()).toBe(sessionsBefore);
    });

    it("a failure at the last step (the session) also rolls back", async () => {
      jest.spyOn(db.HrmsSession, "create").mockRejectedValueOnce(new Error("boom"));
      const body = validBody();
      const res = await signup(body);
      expect(res.status).toBe(500);
      expect((await rowsFor(body.email)).user).toBeNull();
    });

    it("a reused person keeps only their old rows", async () => {
      const company = await createCompany();
      const person = await createPerson();
      await createAccount(person, company.employer, { status: "INACTIVE" });

      jest.spyOn(db.HrmsAccount, "create").mockRejectedValueOnce(new Error("boom"));
      const res = await signup(validBody({ email: person.email, password: PASSWORD, confirmPassword: PASSWORD }));
      expect(res.status).toBe(500);

      const rows = await rowsFor(person.email);
      expect(rows.user.id).toBe(person.id);
      expect(rows.employers).toBe(0);
      expect(rows.accounts).toBe(1);
    });
  });

  it("two sign ups with the same new email at once: one wins, the other gets 409", async () => {
    const email = uniqueEmail("race");
    const [a, b] = await Promise.all([signup(validBody({ email })), signup(validBody({ email }))]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body).toEqual(errorBody("AUTH_EMAIL_TAKEN"));
    const rows = await rowsFor(email);
    expect(rows.employers).toBe(1);
    expect(rows.accounts).toBe(1);
  });
});

// ---------- rate limit (D11) ----------

describe("sign up rate limit", () => {
  it("gives the 11th sign up within a minute from one IP 429 RATE_LIMITED", async () => {
    const limited = express();
    limited.use(language);
    limited.use(express.json());
    limited.use(cookieParser());
    limited.use("/api/auth", createAuthRouter({ windowMs: 60 * 1000, authMax: 10, refreshMax: 60 }));
    limited.use(errorHandler);

    for (let i = 0; i < 10; i += 1) {
      const res = await request(limited).post("/api/auth/signup").send({});
      expect(res.status).toBe(400);
    }
    const eleventh = await request(limited).post("/api/auth/signup").send({});
    expect(eleventh.status).toBe(429);
    expect(eleventh.body).toEqual(errorBody("RATE_LIMITED"));
  });
});
