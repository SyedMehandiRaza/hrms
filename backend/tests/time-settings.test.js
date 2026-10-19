const crypto = require("crypto");
const request = require("supertest");
const bcrypt = require("bcrypt");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const { MESSAGES } = require("../src/constants/messages");

// Time settings API: timezone and financial-year start month (ticket auth-company#11; D30).

const PASSWORD = "Test@12345";

const errorBody = (code, lang = "en") => ({ success: false, code, message: MESSAGES[code][lang] });
// A single bad field answers with that field's own code; the same text sits under the field.
const fieldCodeBody = (code, field, lang = "en") => ({ ...errorBody(code, lang), errors: { [field]: MESSAGES[code][lang] } });

let passwordHash;
let financialYearModule;
let departmentModule;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  [financialYearModule] = await db.Module.findOrCreate({
    where: { module_key: "financial_year" },
    defaults: { name: "Financial Year" },
  });
  [departmentModule] = await db.Module.findOrCreate({ where: { module_key: "department" }, defaults: { name: "Departments" } });
});

beforeEach(() => {
  // Start-month changes are logged with console.info; keep the test output quiet.
  jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  await db.sequelize.close();
});

// ---------- helpers ----------

const uniqueEmail = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}@hrms.test`;
const uniqueName = (prefix) => `${prefix} ${crypto.randomUUID().slice(0, 8)}`;

const createCompany = async ({ settings = {}, withSettings = true } = {}) => {
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: passwordHash });
  const employer = await db.Employer.create({ user_id: owner.id, company_name: "Al Noor Construction", employer_status: "ACTIVE" });
  if (withSettings) await db.CompanyTimeSetting.create({ employer_id: employer.id, timezone: "Asia/Riyadh", fy_start_month: 1, ...settings });
  await db.HrmsAccount.create({ user_id: owner.id, employer_id: employer.id, access_level: "ADMIN", password_setup_required: false });
  return { owner, employer };
};

// January-start year rows ("FY 2026" = 2026-01-01 … 2026-12-31), as sign up and the seed create them.
const createYear = (employer, yearKey, status, extra = {}) =>
  db.FinancialYear.create({
    employer_id: employer.id,
    year_key: yearKey,
    label: `FY ${yearKey}`,
    start_date: `${yearKey}-01-01`,
    end_date: `${yearKey}-12-31`,
    status,
    ...extra,
  });

const createRole = async (employer, flags) => {
  const role = await db.Role.create({ employer_id: employer.id, name: uniqueName("Role") });
  await db.RolePermission.create({
    role_id: role.id,
    module_id: financialYearModule.id,
    can_read: false,
    can_create: false,
    can_update: false,
    can_delete: false,
    ...flags,
  });
  // A flag on another module must not count.
  await db.RolePermission.create({
    role_id: role.id,
    module_id: departmentModule.id,
    can_read: true,
    can_create: true,
    can_update: true,
    can_delete: true,
  });
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

const tokenFor = async (employer, accessLevel, flags) => {
  const role = flags ? await createRole(employer, flags) : null;
  return loginAs((await createLogin(employer, accessLevel, { role })).email);
};

const withAuth = (req, token, lang) => {
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req;
};
const getSettings = (token, lang) => withAuth(request(app).get("/api/company/time-settings"), token, lang);
const patchSettings = (token, body, lang) => withAuth(request(app).patch("/api/company/time-settings"), token, lang).send(body);

const ownerCompany = async (options) => {
  const company = await createCompany(options);
  return { ...company, token: await loginAs(company.owner.email) };
};

const yearsOf = async (employer) =>
  (
    await db.FinancialYear.findAll({
      where: { employer_id: employer.id },
      attributes: ["year_key", "label", "start_date", "end_date", "status"],
      order: [["year_key", "ASC"]],
      raw: true,
    })
  ).map((y) => ({ ...y }));

const settingsOf = (employer) => db.CompanyTimeSetting.findOne({ where: { employer_id: employer.id }, raw: true });

const SETTINGS_SHAPE = {
  timezone: "Asia/Riyadh",
  fy_start_month: 1,
  review_days_before: 30,
  auto_open_next_year: true,
  reopen_window_days: 7,
  lock_mode: "YEARLY",
  pending_on_close: "BLOCK",
  offline_backdate_days: 3,
  fy_start_month_locked: false,
};

// ---------- GET /api/company/time-settings ----------

describe("GET /api/company/time-settings", () => {
  it("returns the owner's time settings", async () => {
    const { token } = await ownerCompany();

    const res = await getSettings(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: SETTINGS_SHAPE });
  });

  it("returns the stored values, not the defaults", async () => {
    const { token } = await ownerCompany({
      settings: { timezone: "Europe/London", fy_start_month: 4, lock_mode: "MONTHLY", review_days_before: 15 },
    });

    const res = await getSettings(token);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      ...SETTINGS_SHAPE,
      timezone: "Europe/London",
      fy_start_month: 4,
      lock_mode: "MONTHLY",
      review_days_before: 15,
    });
  });

  it("says the start month is locked once a year is CLOSED and locked", async () => {
    const { employer, token } = await ownerCompany();
    await createYear(employer, 2025, "CLOSED", { is_locked: true });
    await createYear(employer, 2026, "OPEN");

    const res = await getSettings(token);

    expect(res.status).toBe(200);
    expect(res.body.data.fy_start_month_locked).toBe(true);
  });

  it("also locks the start month for a CLOSED year that is not locked (D30)", async () => {
    const { employer, token } = await ownerCompany();
    await createYear(employer, 2025, "CLOSED", { is_locked: false });

    const res = await getSettings(token);

    expect(res.body.data.fy_start_month_locked).toBe(true);
  });

  it("also locks the start month for a CLOSING year (D30)", async () => {
    const { employer, token } = await ownerCompany();
    await createYear(employer, 2025, "CLOSING");
    await createYear(employer, 2026, "OPEN");

    const res = await getSettings(token);

    expect(res.body.data.fy_start_month_locked).toBe(true);
  });

  it("does not lock the start month while every year is PLANNED or OPEN", async () => {
    const { employer, token } = await ownerCompany();
    await createYear(employer, 2026, "OPEN");
    await createYear(employer, 2027, "PLANNED");

    const res = await getSettings(token);

    expect(res.body.data.fy_start_month_locked).toBe(false);
  });

  it("returns only the caller's own company settings", async () => {
    const { employer: other } = await createCompany({ settings: { timezone: "Europe/London", fy_start_month: 7 } });
    await createYear(other, 2025, "CLOSED", { is_locked: true });
    const { token } = await ownerCompany();

    const res = await getSettings(token);

    expect(res.body.data).toEqual(SETTINGS_SHAPE);
  });

  it("returns 404 NOT_FOUND when the company has no time settings", async () => {
    const { token } = await ownerCompany({ withSettings: false });

    const res = await getSettings(token);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it("lets a SUB_ADMIN with financial-year read see the settings", async () => {
    const { employer } = await createCompany();
    const token = await tokenFor(employer, "SUB_ADMIN", { can_read: true });

    const res = await getSettings(token);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(SETTINGS_SHAPE);
  });

  it("forbids a SUB_ADMIN without financial-year read (even with update)", async () => {
    const { employer } = await createCompany();
    const token = await tokenFor(employer, "SUB_ADMIN", { can_update: true, can_create: true, can_delete: true });

    const res = await getSettings(token);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])("forbids a %s with no role", async (level) => {
    const { employer } = await createCompany();
    const token = await tokenFor(employer, level);

    const res = await getSettings(token);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("forbids a STAFFING_COMPANY login even with a financial-year role (plan §2)", async () => {
    const { employer } = await createCompany();
    const token = await tokenFor(employer, "STAFFING_COMPANY", { can_read: true, can_update: true });

    const res = await getSettings(token);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("returns 401 AUTH_REQUIRED without a token", async () => {
    const res = await getSettings();
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("returns 401 AUTH_REQUIRED for an invalid token", async () => {
    const res = await getSettings("not-a-token");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("answers the 403 in Arabic", async () => {
    const { employer } = await createCompany();
    const token = await tokenFor(employer, "EMPLOYEE");

    const res = await getSettings(token, "ar");

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN", "ar"));
  });
});

// ---------- PATCH /api/company/time-settings ----------

describe("PATCH /api/company/time-settings", () => {
  describe("timezone", () => {
    it("saves a valid timezone and returns the settings", async () => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, { timezone: "Europe/London" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { ...SETTINGS_SHAPE, timezone: "Europe/London" } });
      expect((await settingsOf(employer)).timezone).toBe("Europe/London");
    });

    it("trims the timezone", async () => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, { timezone: "  Asia/Dubai " });

      expect(res.status).toBe(200);
      expect((await settingsOf(employer)).timezone).toBe("Asia/Dubai");
    });

    it("accepts UTC", async () => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, { timezone: "UTC" });

      expect(res.status).toBe(200);
      expect((await settingsOf(employer)).timezone).toBe("UTC");
    });

    it("accepts a current IANA name that Node lists under its older alias (Asia/Kolkata)", async () => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, { timezone: "Asia/Kolkata" });

      expect(res.status).toBe(200);
      expect((await settingsOf(employer)).timezone).toBe("Asia/Kolkata");
    });

    it("stores a wrong-case zone name with its real case", async () => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, { timezone: "europe/london" });

      expect(res.status).toBe(200);
      expect(res.body.data.timezone).toBe("Europe/London");
      expect((await settingsOf(employer)).timezone).toBe("Europe/London");
    });

    it("does not rewrite the financial years (the timezone applies going forward)", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2026, "OPEN");
      const before = await yearsOf(employer);

      const res = await patchSettings(token, { timezone: "Asia/Kolkata" });

      expect(res.status).toBe(200);
      expect(await yearsOf(employer)).toEqual(before);
    });

    it.each([
      ["an unknown zone", "Mars/Base"],
      ["an offset", "+03:00"],
      ["a path-like value", "../Europe/London"],
      ["an empty string", ""],
      ["blank spaces", "   "],
      ["a number", 3],
      ["null", null],
      ["a too-long string", "A".repeat(65)],
    ])("rejects %s with 400 COMPANY_TIMEZONE_INVALID", async (_label, timezone) => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, { timezone });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(fieldCodeBody("COMPANY_TIMEZONE_INVALID", "timezone"));
      expect((await settingsOf(employer)).timezone).toBe("Asia/Riyadh");
    });

    it("answers in Arabic", async () => {
      const { token } = await ownerCompany();

      const res = await patchSettings(token, { timezone: "Mars/Base" }, "ar");

      expect(res.status).toBe(400);
      expect(res.body).toEqual(fieldCodeBody("COMPANY_TIMEZONE_INVALID", "timezone", "ar"));
    });
  });

  describe("fy_start_month", () => {
    it("re-dates every PLANNED and OPEN year to April–March with new labels", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2026, "OPEN");
      await createYear(employer, 2027, "PLANNED");

      const res = await patchSettings(token, { fy_start_month: 4 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { ...SETTINGS_SHAPE, fy_start_month: 4 } });
      expect((await settingsOf(employer)).fy_start_month).toBe(4);
      expect(await yearsOf(employer)).toEqual([
        { year_key: 2026, label: "FY 2026-27", start_date: "2026-04-01", end_date: "2027-03-31", status: "OPEN" },
        { year_key: 2027, label: "FY 2027-28", start_date: "2027-04-01", end_date: "2028-03-31", status: "PLANNED" },
      ]);
    });

    it("re-dates back to a January year with the 'FY <year>' label", async () => {
      const { employer, token } = await ownerCompany({ settings: { fy_start_month: 4 } });
      await db.FinancialYear.create({
        employer_id: employer.id,
        year_key: 2026,
        label: "FY 2026-27",
        start_date: "2026-04-01",
        end_date: "2027-03-31",
        status: "OPEN",
      });

      const res = await patchSettings(token, { fy_start_month: 1 });

      expect(res.status).toBe(200);
      expect(await yearsOf(employer)).toEqual([
        { year_key: 2026, label: "FY 2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "OPEN" },
      ]);
    });

    it("ends a March-start year on the last day of February, leap years included", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2027, "OPEN");
      await createYear(employer, 2028, "PLANNED");

      const res = await patchSettings(token, { fy_start_month: 3 });

      expect(res.status).toBe(200);
      expect(await yearsOf(employer)).toEqual([
        { year_key: 2027, label: "FY 2027-28", start_date: "2027-03-01", end_date: "2028-02-29", status: "OPEN" },
        { year_key: 2028, label: "FY 2028-29", start_date: "2028-03-01", end_date: "2029-02-28", status: "PLANNED" },
      ]);
    });

    it("uses a two-digit end year across a century (FY 2099-00)", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2099, "PLANNED");

      const res = await patchSettings(token, { fy_start_month: 12 });

      expect(res.status).toBe(200);
      expect(await yearsOf(employer)).toEqual([
        { year_key: 2099, label: "FY 2099-00", start_date: "2099-12-01", end_date: "2100-11-30", status: "PLANNED" },
      ]);
    });

    it("accepts the month as a numeric string", async () => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, { fy_start_month: "7" });

      expect(res.status).toBe(200);
      expect((await settingsOf(employer)).fy_start_month).toBe(7);
    });

    it("returns 409 COMPANY_FY_START_LOCKED with a CLOSED year that is not locked, and changes nothing (D30)", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2024, "CLOSED", { is_locked: false });
      await createYear(employer, 2026, "OPEN");
      const before = await yearsOf(employer);

      const res = await patchSettings(token, { fy_start_month: 4 });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("COMPANY_FY_START_LOCKED"));
      expect(await yearsOf(employer)).toEqual(before);
      expect((await settingsOf(employer)).fy_start_month).toBe(1);
    });

    it("returns 409 COMPANY_FY_START_LOCKED with a CLOSING year, and changes nothing (D30)", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2024, "CLOSING");
      await createYear(employer, 2026, "PLANNED");
      const before = await yearsOf(employer);

      const res = await patchSettings(token, { fy_start_month: 4 });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("COMPANY_FY_START_LOCKED"));
      expect(await yearsOf(employer)).toEqual(before);
      expect((await settingsOf(employer)).fy_start_month).toBe(1);
    });

    it("allows the current start month with a new timezone while a CLOSING year exists", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2025, "CLOSING");

      const res = await patchSettings(token, { timezone: "Europe/London", fy_start_month: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ...SETTINGS_SHAPE, timezone: "Europe/London", fy_start_month_locked: true });
    });

    it("does not touch another company's years", async () => {
      const { employer: other } = await createCompany();
      await createYear(other, 2026, "OPEN");
      const { token } = await ownerCompany();

      const res = await patchSettings(token, { fy_start_month: 4 });

      expect(res.status).toBe(200);
      expect(await yearsOf(other)).toEqual([
        { year_key: 2026, label: "FY 2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "OPEN" },
      ]);
      expect((await settingsOf(other)).fy_start_month).toBe(1);
    });

    it("returns 409 COMPANY_FY_START_LOCKED with a CLOSED and locked year, and changes nothing", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2025, "CLOSED", { is_locked: true });
      await createYear(employer, 2026, "OPEN");
      const before = await yearsOf(employer);

      const res = await patchSettings(token, { fy_start_month: 4 });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("COMPANY_FY_START_LOCKED"));
      expect(await yearsOf(employer)).toEqual(before);
      expect((await settingsOf(employer)).fy_start_month).toBe(1);
    });

    it("does not save the timezone either when the start month is locked", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2025, "CLOSED", { is_locked: true });

      const res = await patchSettings(token, { timezone: "Europe/London", fy_start_month: 4 });

      expect(res.status).toBe(409);
      expect((await settingsOf(employer)).timezone).toBe("Asia/Riyadh");
    });

    it("answers the 409 in Arabic", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2025, "CLOSED", { is_locked: true });

      const res = await patchSettings(token, { fy_start_month: 4 }, "ar");

      expect(res.status).toBe(409);
      expect(res.body).toEqual(errorBody("COMPANY_FY_START_LOCKED", "ar"));
    });

    it("allows sending the current start month while locked (no change) together with a new timezone", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2025, "CLOSED", { is_locked: true });
      await createYear(employer, 2026, "OPEN");
      const before = await yearsOf(employer);

      const res = await patchSettings(token, { timezone: "Europe/London", fy_start_month: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ...SETTINGS_SHAPE, timezone: "Europe/London", fy_start_month_locked: true });
      expect(await yearsOf(employer)).toEqual(before);
    });

    it.each([
      ["13", 13],
      ["0", 0],
      ["a negative month", -1],
      ["a fraction", 4.5],
      ["a word", "April"],
      ["an empty string", ""],
      ["null", null],
      ["a boolean", true],
    ])("rejects %s with 400 COMPANY_FY_START_INVALID", async (_label, month) => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2026, "OPEN");
      const before = await yearsOf(employer);

      const res = await patchSettings(token, { fy_start_month: month });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(fieldCodeBody("COMPANY_FY_START_INVALID", "fy_start_month"));
      expect(await yearsOf(employer)).toEqual(before);
    });

    it("answers in Arabic", async () => {
      const { token } = await ownerCompany();

      const res = await patchSettings(token, { fy_start_month: 13 }, "ar");

      expect(res.status).toBe(400);
      expect(res.body).toEqual(fieldCodeBody("COMPANY_FY_START_INVALID", "fy_start_month", "ar"));
    });

    it("rolls everything back when a step fails", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2026, "OPEN");
      await createYear(employer, 2027, "PLANNED");
      const before = await yearsOf(employer);
      jest.spyOn(console, "error").mockImplementation(() => {});
      // The settings row is written last, after the years.
      jest.spyOn(db.CompanyTimeSetting.prototype, "update").mockRejectedValueOnce(new Error("boom"));

      const res = await patchSettings(token, { fy_start_month: 4, timezone: "Europe/London" });

      expect(res.status).toBe(500);
      expect(res.body).toEqual(errorBody("INTERNAL_ERROR"));
      expect(await yearsOf(employer)).toEqual(before);
      const settings = await settingsOf(employer);
      expect(settings.fy_start_month).toBe(1);
      expect(settings.timezone).toBe("Asia/Riyadh");
    });
  });

  describe("body", () => {
    it("saves both fields at once", async () => {
      const { employer, token } = await ownerCompany();
      await createYear(employer, 2026, "OPEN");

      const res = await patchSettings(token, { timezone: "Europe/London", fy_start_month: 4 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ...SETTINGS_SHAPE, timezone: "Europe/London", fy_start_month: 4 });
      expect((await yearsOf(employer))[0].label).toBe("FY 2026-27");
    });

    it("ignores any other field (e.g. lock mode)", async () => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, {
        timezone: "Europe/London",
        lock_mode: "MONTHLY",
        review_days_before: 99,
        employer_id: crypto.randomUUID(),
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ...SETTINGS_SHAPE, timezone: "Europe/London" });
      const settings = await settingsOf(employer);
      expect(settings.lock_mode).toBe("YEARLY");
      expect(settings.review_days_before).toBe(30);
      expect(settings.employer_id).toBe(employer.id);
    });

    it("reports both fields with VALIDATION_FAILED when both are invalid", async () => {
      const { token } = await ownerCompany();

      const res = await patchSettings(token, { timezone: "Mars/Base", fy_start_month: 13 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ...errorBody("VALIDATION_FAILED"),
        errors: { timezone: MESSAGES.COMPANY_TIMEZONE_INVALID.en, fy_start_month: MESSAGES.COMPANY_FY_START_INVALID.en },
      });
    });

    it.each([
      ["an empty body", {}],
      ["only ignored fields", { lock_mode: "MONTHLY" }],
    ])("rejects %s with VALIDATION_FAILED on both fields", async (_label, body) => {
      const { employer, token } = await ownerCompany();

      const res = await patchSettings(token, body);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ...errorBody("VALIDATION_FAILED"),
        errors: { timezone: MESSAGES.COMPANY_TIMEZONE_INVALID.en, fy_start_month: MESSAGES.COMPANY_FY_START_INVALID.en },
      });
      expect((await settingsOf(employer)).lock_mode).toBe("YEARLY");
    });

    it("returns 404 NOT_FOUND when the company has no time settings", async () => {
      const { token } = await ownerCompany({ withSettings: false });

      const res = await patchSettings(token, { timezone: "Europe/London" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    });
  });

  describe("access", () => {
    it("lets a SUB_ADMIN with financial-year update save", async () => {
      const { employer } = await createCompany();
      await createYear(employer, 2026, "OPEN");
      const token = await tokenFor(employer, "SUB_ADMIN", { can_update: true });

      const res = await patchSettings(token, { fy_start_month: 4, timezone: "Europe/London" });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ...SETTINGS_SHAPE, timezone: "Europe/London", fy_start_month: 4 });
      expect((await yearsOf(employer))[0].start_date).toBe("2026-04-01");
    });

    it("forbids a SUB_ADMIN with only financial-year read", async () => {
      const { employer } = await createCompany();
      const token = await tokenFor(employer, "SUB_ADMIN", { can_read: true, can_create: true, can_delete: true });

      const res = await patchSettings(token, { timezone: "Europe/London" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
      expect((await settingsOf(employer)).timezone).toBe("Asia/Riyadh");
    });

    it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])("forbids a %s with no role", async (level) => {
      const { employer } = await createCompany();
      const token = await tokenFor(employer, level);

      const res = await patchSettings(token, { timezone: "Europe/London" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    });

    it("lets an EMPLOYEE whose role has financial-year update save (plan §2)", async () => {
      const { employer } = await createCompany();
      const token = await tokenFor(employer, "EMPLOYEE", { can_update: true });

      const res = await patchSettings(token, { timezone: "Europe/London" });

      expect(res.status).toBe(200);
      expect((await settingsOf(employer)).timezone).toBe("Europe/London");
    });

    it("forbids a STAFFING_COMPANY login even with a financial-year role (plan §2)", async () => {
      const { employer } = await createCompany();
      const token = await tokenFor(employer, "STAFFING_COMPANY", { can_read: true, can_update: true });

      const res = await patchSettings(token, { timezone: "Europe/London" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
      expect((await settingsOf(employer)).timezone).toBe("Asia/Riyadh");
    });

    it("checks permission before validating the body", async () => {
      const { employer } = await createCompany();
      const token = await tokenFor(employer, "SUB_ADMIN", { can_read: true });

      const res = await patchSettings(token, { timezone: "Mars/Base" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    });

    it("answers the 403 in Arabic", async () => {
      const { employer } = await createCompany();
      const token = await tokenFor(employer, "SUB_ADMIN", { can_read: true });

      const res = await patchSettings(token, { timezone: "Europe/London" }, "ar");

      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN", "ar"));
    });

    it("returns 401 AUTH_REQUIRED without a token", async () => {
      const res = await patchSettings(undefined, { timezone: "Europe/London" });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
    });

    it("returns 401 AUTH_REQUIRED for an invalid token", async () => {
      const res = await patchSettings("not-a-token", { timezone: "Europe/London" });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
    });
  });
});
