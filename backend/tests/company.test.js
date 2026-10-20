const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcrypt");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";
// Logos go to a throw-away folder, removed after the run.
const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-uploads-"));
process.env.UPLOAD_DIR = UPLOAD_DIR;

const app = require("../src/app");
const db = require("../src/models");
const { seedId } = require("../src/utils/seed");
const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");

// Company profile and logo API (ticket auth-company#10; D27–D29).

const PASSWORD = "Test@12345";
const MB = 1024 * 1024;

const errorBody = (code, lang = "en") => ({ success: false, code, message: MESSAGES[code][lang] });
const validationBody = (errors, lang = "en") => ({ ...errorBody("VALIDATION_FAILED", lang), errors });
const fieldText = (key, lang = "en") => FIELD_MESSAGES[key][lang];

let passwordHash;
const modules = [];

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  for (const [key, name] of [
    ["department", "Departments"],
    ["designation", "Designations"],
    ["employee", "Employees"],
    ["financial_year", "Financial Year"],
  ]) {
    const [row] = await db.Module.findOrCreate({ where: { module_key: key }, defaults: { name } });
    modules.push(row);
  }
});

beforeEach(() => {
  // Profile changes are logged with console.info; keep the test output quiet.
  jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  await db.sequelize.close();
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
});

// ---------- helpers ----------

const uniqueEmail = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}@hrms.test`;
const uniqueName = (prefix) => `${prefix} ${crypto.randomUUID().slice(0, 8)}`;

const createIndustry = (name = uniqueName("Industry")) => db.IndustryType.create({ industry_name: name });

const createCompany = async ({ name = "Al Noor Construction", timezone = "Asia/Riyadh" } = {}) => {
  const industry = await createIndustry();
  const owner = await db.User.create({ name: "Owner Person", email: uniqueEmail("owner"), password: passwordHash });
  const employer = await db.Employer.create({
    user_id: owner.id,
    industry_type_id: industry.id,
    company_name: name,
    company_email: "info@alnoor.test",
    company_phone_number: "+966501234567",
    phone_country: "SA",
    address: "King Fahd Road, Riyadh",
    employer_status: "ACTIVE",
  });
  if (timezone) await db.CompanyTimeSetting.create({ employer_id: employer.id, timezone });
  await db.HrmsAccount.create({ user_id: owner.id, employer_id: employer.id, access_level: "ADMIN", password_setup_required: false });
  return { owner, employer, industry };
};

const createAllFlagsRole = async (employer) => {
  const role = await db.Role.create({ employer_id: employer.id, name: uniqueName("Role") });
  for (const m of modules) {
    await db.RolePermission.create({
      role_id: role.id,
      module_id: m.id,
      can_read: true,
      can_create: true,
      can_update: true,
      can_delete: true,
    });
  }
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

const withAuth = (req, token, lang) => {
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (lang) req.set("Accept-Language", lang);
  return req;
};
const getCompany = (token, lang) => withAuth(request(app).get("/api/company"), token, lang);
const putCompany = (token, body, lang) => withAuth(request(app).put("/api/company"), token, lang).send(body);
const uploadLogo = (token, buffer, filename = "logo.png", lang) =>
  withAuth(request(app).put("/api/company/logo"), token, lang).attach("logo", buffer, filename);
const deleteLogo = (token, lang) => withAuth(request(app).delete("/api/company/logo"), token, lang);
const listIndustries = (token, lang) => withAuth(request(app).get("/api/industry-types"), token, lang);

// Files whose first bytes say what they are (only the magic bytes are checked).
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const fileOf = (signature, size = 1024) => Buffer.concat([signature, Buffer.alloc(size - signature.length, 1)]);
const png = (size) => fileOf(PNG_SIGNATURE, size);
const jpeg = (size) => fileOf(JPEG_SIGNATURE, size);
const gif = () => fileOf(Buffer.from("GIF89a", "ascii"));
const svg = () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');

const fileFromUrl = (url) => path.join(UPLOAD_DIR, url.replace(/^\/uploads\//, ""));

let company;
let ownerToken;
const setup = async () => {
  if (!company) {
    company = await createCompany();
    ownerToken = await loginAs(company.owner.email);
  }
  return { ...company, ownerToken };
};

const validBody = (overrides = {}) => ({
  companyName: "Al Noor Contracting",
  industryTypeId: company.industry.id,
  email: "Contact@AlNoor.test",
  phone: "0551112222",
  phoneCountry: "SA",
  address: "Olaya Street, Riyadh",
  ...overrides,
});

// ---------- GET /api/company ----------

describe("GET /api/company", () => {
  it("returns the owner's company basics with industry, timezone and currency SAR", async () => {
    const { employer, industry } = await createCompany({ name: "Desert Rose Trading" });
    const token = await loginAs((await db.User.findByPk(employer.user_id)).email);

    const res = await getCompany(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: employer.id,
        company_name: "Desert Rose Trading",
        industry_type_id: industry.id,
        industry_name: industry.industry_name,
        company_email: "info@alnoor.test",
        company_phone_number: "+966501234567",
        phone_country: "SA",
        address: "King Fahd Road, Riyadh",
        company_logo: null,
        created_at: expect.any(String),
        timezone: "Asia/Riyadh",
        currency: "SAR",
        country: { id: seedId("country:SA"), iso2: "SA", name: "Saudi Arabia", callingCode: "+966" },
      },
    });
    expect(new Date(res.body.data.created_at).getTime()).toBe((await employer.reload()).createdAt.getTime());
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])("lets a %s read their own company", async (level) => {
    const { employer } = await setup();
    const person = await createLogin(employer, level);
    const token = await loginAs(person.email);

    const res = await getCompany(token);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(employer.id);
    expect(res.body.data.company_name).toBe(employer.company_name);
    expect(res.body.data.currency).toBe("SAR");
  });

  it("returns timezone null when the company has no time settings", async () => {
    const { owner } = await createCompany({ timezone: null });
    const token = await loginAs(owner.email);

    const res = await getCompany(token);

    expect(res.status).toBe(200);
    expect(res.body.data.timezone).toBeNull();
  });

  it("only ever returns the caller's own company", async () => {
    const { employer } = await setup();
    const other = await createCompany({ name: "Second Company" });
    const otherToken = await loginAs(other.owner.email);

    const mine = await getCompany(ownerToken);
    const theirs = await getCompany(otherToken);

    expect(mine.body.data.id).toBe(employer.id);
    expect(theirs.body.data.id).toBe(other.employer.id);
    expect(theirs.body.data.company_name).toBe("Second Company");
  });

  it("ignores an employer id passed in the query", async () => {
    const { employer } = await setup();
    const other = await createCompany();

    const res = await withAuth(request(app).get(`/api/company?employerId=${other.employer.id}`), ownerToken);

    expect(res.body.data.id).toBe(employer.id);
  });

  it("returns 401 without a token", async () => {
    const res = await getCompany();
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("returns 401 with an invalid token", async () => {
    const res = await getCompany("not-a-token");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("answers 401 in Arabic", async () => {
    const res = await getCompany(null, "ar");
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED", "ar"));
  });
});

// ---------- GET /api/industry-types ----------

describe("GET /api/industry-types", () => {
  it("lists non-deleted industries as {id, name} ordered by name", async () => {
    await setup();
    const tag = crypto.randomUUID().slice(0, 8);
    const zeta = await createIndustry(`zz ${tag} Zeta`);
    const alpha = await createIndustry(`zz ${tag} Alpha`);
    const removed = await createIndustry(`zz ${tag} Beta`);
    await removed.destroy();

    const res = await listIndustries(ownerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    res.body.data.forEach((row) => expect(Object.keys(row).sort()).toEqual(["id", "name"]));
    const mine = res.body.data.filter((row) => row.name.startsWith(`zz ${tag}`));
    expect(mine).toEqual([
      { id: alpha.id, name: alpha.industry_name },
      { id: zeta.id, name: zeta.industry_name },
    ]);
  });

  it("is readable by any login, e.g. a staffing company", async () => {
    const { employer } = await setup();
    const person = await createLogin(employer, "STAFFING_COMPANY");
    const res = await listIndustries(await loginAs(person.email));
    expect(res.status).toBe(200);
  });

  it("returns 401 without a token", async () => {
    const res = await listIndustries();
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });
});

// ---------- PUT /api/company ----------

describe("PUT /api/company", () => {
  it("saves the profile (trimmed, email lowercased) and returns the new company", async () => {
    const { employer } = await setup();
    const industry = await createIndustry();

    const res = await putCompany(
      ownerToken,
      validBody({
        companyName: "  Al Noor Contracting  ",
        industryTypeId: industry.id,
        email: "  Contact@AlNoor.TEST ",
        phone: " 055 111 2222 ",
        phoneCountry: " sa ",
        address: "  Olaya Street, Riyadh  ",
      })
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: employer.id,
      company_name: "Al Noor Contracting",
      industry_type_id: industry.id,
      industry_name: industry.industry_name,
      company_email: "contact@alnoor.test",
      company_phone_number: "+966551112222",
      phone_country: "SA",
      address: "Olaya Street, Riyadh",
      timezone: "Asia/Riyadh",
      currency: "SAR",
      country: { id: seedId("country:SA"), iso2: "SA", name: "Saudi Arabia", callingCode: "+966" },
    });

    const again = await getCompany(ownerToken);
    expect(again.body.data).toEqual(res.body.data);
  });

  it("logs who changed which fields", async () => {
    const { employer, owner } = await setup();
    await putCompany(ownerToken, validBody());
    console.info.mockClear();

    await putCompany(ownerToken, validBody({ companyName: "Renamed Company", phone: "+919876543210", phoneCountry: "IN" }));

    expect(console.info).toHaveBeenCalledWith("[company] profile updated", {
      employerId: employer.id,
      userId: owner.id,
      fields: ["companyName", "phone", "phoneCountry"],
    });
  });

  it("last write wins", async () => {
    await setup();
    await putCompany(ownerToken, validBody({ companyName: "First Save" }));
    await putCompany(ownerToken, validBody({ companyName: "Second Save" }));

    const res = await getCompany(ownerToken);
    expect(res.body.data.company_name).toBe("Second Save");
  });

  it("allows a name and email used by another company (not unique)", async () => {
    await setup();
    const other = await createCompany({ name: "Shared Name Co" });
    await db.Employer.update({ company_email: "shared@company.test" }, { where: { id: other.employer.id } });

    const res = await putCompany(ownerToken, validBody({ companyName: "Shared Name Co", email: "shared@company.test" }));

    expect(res.status).toBe(200);
  });

  it("changes only the caller's company", async () => {
    const { employer } = await setup();
    const other = await createCompany({ name: "Untouched Company" });
    const otherToken = await loginAs(other.owner.email);

    const res = await putCompany(otherToken, validBody({ companyName: "Other Renamed", industryTypeId: other.industry.id }));

    expect(res.body.data.id).toBe(other.employer.id);
    expect((await db.Employer.findByPk(employer.id)).company_name).not.toBe("Other Renamed");
    expect((await db.Employer.findByPk(other.employer.id)).company_name).toBe("Other Renamed");
  });

  it("accepts the boundaries: name 2 and 100, address 500, and any valid number of the phone country", async () => {
    await setup();
    for (const overrides of [
      { companyName: "AB" },
      { companyName: "N".repeat(100) },
      { address: "A".repeat(500) },
      { phone: "011 234 5678" },
      { phone: "+966551112222" },
      { phone: "98765 43210", phoneCountry: "IN" },
    ]) {
      const res = await putCompany(ownerToken, validBody(overrides));
      expect(res.status).toBe(200);
    }
  });

  it("reports every missing field at once", async () => {
    await setup();
    const res = await putCompany(ownerToken, {});

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      validationBody({
        companyName: "Company name is required",
        industryTypeId: "Please select an industry",
        email: "Email is required",
        phone: "Phone is required",
        phoneCountry: "Select the phone number's country.",
        address: "Address is required",
      })
    );
  });

  it("treats blank strings as missing", async () => {
    await setup();
    const res = await putCompany(ownerToken, { companyName: "   ", industryTypeId: "", email: " ", phone: "", phoneCountry: " ", address: "  " });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      companyName: "Company name is required",
      industryTypeId: "Please select an industry",
      email: "Email is required",
      phone: "Phone is required",
      phoneCountry: "Select the phone number's country.",
      address: "Address is required",
    });
  });

  it.each([
    ["companyName", { companyName: "A" }, "Company name must be at least 2 characters"],
    ["companyName", { companyName: "  A  " }, "Company name must be at least 2 characters"],
    ["companyName", { companyName: "N".repeat(101) }, "Company name cannot exceed 100 characters"],
    ["phone", { phone: "12345" }, "Enter a valid phone number for the selected country."],
    ["phone", { phone: "1234567890123456" }, "Enter a valid phone number for the selected country."],
    ["phone", { phone: "+919876543210" }, "Enter a valid phone number for the selected country."],
    ["phone", { phone: "0551112222", phoneCountry: "IN" }, "Enter a valid phone number for the selected country."],
    ["phoneCountry", { phoneCountry: undefined }, "Select the phone number's country."],
    ["phoneCountry", { phoneCountry: "ZZ" }, "Select the phone number's country."],
    ["email", { email: "not-an-email" }, "Enter a valid email"],
    ["email", { email: "a@b" }, "Enter a valid email"],
    ["address", { address: "A".repeat(501) }, "Address cannot exceed 500 characters"],
  ])("rejects a bad %s: %j", async (field, overrides, message) => {
    await setup();
    const res = await putCompany(ownerToken, validBody(overrides));

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ [field]: message }));
  });

  it("rejects an industry id that does not exist", async () => {
    await setup();
    const res = await putCompany(ownerToken, validBody({ industryTypeId: crypto.randomUUID() }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ industryTypeId: "Please select an industry" }));
  });

  it("rejects a deleted industry", async () => {
    await setup();
    const industry = await createIndustry();
    await industry.destroy();

    const res = await putCompany(ownerToken, validBody({ industryTypeId: industry.id }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ industryTypeId: "Please select an industry" }));
  });

  it("does not save anything when validation fails", async () => {
    const { employer } = await setup();
    const before = (await db.Employer.findByPk(employer.id)).company_name;

    await putCompany(ownerToken, validBody({ companyName: "Changed Name", phone: "1" }));

    expect((await db.Employer.findByPk(employer.id)).company_name).toBe(before);
  });

  it("answers field errors in Arabic", async () => {
    await setup();
    const res = await putCompany(ownerToken, { companyName: "A", phone: "12", phoneCountry: "SA", email: "bad", address: "A".repeat(501) }, "ar");

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      validationBody(
        {
          companyName: fieldText("companyNameMin", "ar"),
          industryTypeId: fieldText("industryRequired", "ar"),
          email: fieldText("emailEnterValid", "ar"),
          phone: fieldText("phoneInvalidForCountry", "ar"),
          address: fieldText("addressMax", "ar"),
        },
        "ar"
      )
    );
  });

  it("returns 401 without a token", async () => {
    const res = await putCompany(null, {});
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("forbids a sub-admin even with every role flag", async () => {
    const { employer } = await setup();
    const role = await createAllFlagsRole(employer);
    const person = await createLogin(employer, "SUB_ADMIN", { role });
    const token = await loginAs(person.email);

    const res = await putCompany(token, validBody({ companyName: "Hijacked" }));

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    expect(res.body.message).toBe("You don't have permission to do this.");
    expect((await db.Employer.findByPk(employer.id)).company_name).not.toBe("Hijacked");
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])("forbids a %s", async (level) => {
    const { employer } = await setup();
    const person = await createLogin(employer, level);

    const res = await putCompany(await loginAs(person.email), validBody());

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("answers 403 in Arabic", async () => {
    const { employer } = await setup();
    const person = await createLogin(employer, "EMPLOYEE");
    const res = await putCompany(await loginAs(person.email), validBody(), "ar");
    expect(res.body).toEqual(errorBody("FORBIDDEN", "ar"));
  });
});

// ---------- PUT / DELETE /api/company/logo ----------

describe("PUT /api/company/logo", () => {
  let owner;
  let token;

  beforeEach(async () => {
    owner = await createCompany();
    token = await loginAs(owner.owner.email);
  });

  it("stores a PNG and returns the company with the logo URL", async () => {
    const file = png(4096);
    const res = await uploadLogo(token, file, "logo.png");

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(owner.employer.id);
    expect(res.body.data.company_logo).toMatch(/^\/uploads\/logos\/[0-9a-f-]{36}\.png$/);
    expect(fs.readFileSync(fileFromUrl(res.body.data.company_logo))).toEqual(file);

    const again = await getCompany(token);
    expect(again.body.data.company_logo).toBe(res.body.data.company_logo);
  });

  it("stores a JPG as .jpg", async () => {
    const res = await uploadLogo(token, jpeg(2048), "photo.jpeg");

    expect(res.status).toBe(200);
    expect(res.body.data.company_logo).toMatch(/^\/uploads\/logos\/[0-9a-f-]{36}\.jpg$/);
    expect(fs.existsSync(fileFromUrl(res.body.data.company_logo))).toBe(true);
  });

  it("decides the type by content, not the file name", async () => {
    const res = await uploadLogo(token, png(1024), "logo.jpg");
    expect(res.status).toBe(200);
    expect(res.body.data.company_logo).toMatch(/\.png$/);
  });

  it("accepts exactly 2 MB", async () => {
    const res = await uploadLogo(token, png(2 * MB), "big.png");
    expect(res.status).toBe(200);
  });

  it("shows the new logo in /auth/me", async () => {
    const res = await uploadLogo(token, png(1024));
    const me = await withAuth(request(app).get("/api/auth/me"), token);
    expect(me.body.data.company.logo).toBe(res.body.data.company_logo);
  });

  it("serves the stored logo publicly, readable from the UI origin", async () => {
    const file = png(1024);
    const res = await uploadLogo(token, file);

    const served = await request(app).get(res.body.data.company_logo);

    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(served.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(Buffer.from(served.body)).toEqual(file);
  });

  it("does not list the upload folder", async () => {
    await uploadLogo(token, png(1024));
    for (const url of ["/uploads", "/uploads/", "/uploads/logos", "/uploads/logos/"]) {
      const res = await request(app).get(url);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND"));
    }
  });

  it("replacing the logo deletes the old file", async () => {
    const first = await uploadLogo(token, png(1024));
    const oldFile = fileFromUrl(first.body.data.company_logo);
    expect(fs.existsSync(oldFile)).toBe(true);

    const second = await uploadLogo(token, jpeg(1024), "new.jpg");

    expect(second.status).toBe(200);
    expect(second.body.data.company_logo).not.toBe(first.body.data.company_logo);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(fileFromUrl(second.body.data.company_logo))).toBe(true);
  });

  it.each([
    ["a 2.1 MB image", () => png(Math.round(2.1 * MB)), "big.png"],
    ["2 MB plus one byte", () => png(2 * MB + 1), "big.png"],
    ["a GIF", gif, "logo.gif"],
    ["an SVG", svg, "logo.svg"],
    ["a text file renamed to .png", () => Buffer.from("just some text, not an image"), "fake.png"],
    ["an empty file", () => Buffer.alloc(0), "empty.png"],
  ])("rejects %s with COMPANY_LOGO_INVALID", async (label, makeFile, filename) => {
    const res = await uploadLogo(token, makeFile(), filename);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("COMPANY_LOGO_INVALID"));
    expect(res.body.message).toBe("Logo must be a JPG or PNG image up to 2 MB.");
    expect((await db.Employer.findByPk(owner.employer.id)).company_logo).toBeNull();
  });

  it("rejects a request without a file", async () => {
    const res = await withAuth(request(app).put("/api/company/logo"), token).field("name", "x");
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("COMPANY_LOGO_INVALID"));
  });

  it("rejects a JSON request", async () => {
    const res = await withAuth(request(app).put("/api/company/logo"), token).send({ logo: "x" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("COMPANY_LOGO_INVALID"));
  });

  it("rejects a file under another field name", async () => {
    const res = await withAuth(request(app).put("/api/company/logo"), token).attach("image", png(1024), "logo.png");
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("COMPANY_LOGO_INVALID"));
  });

  it("keeps the current logo when a bad file is sent", async () => {
    const good = await uploadLogo(token, png(1024));
    const res = await uploadLogo(token, gif(), "logo.gif");

    expect(res.status).toBe(400);
    expect((await getCompany(token)).body.data.company_logo).toBe(good.body.data.company_logo);
    expect(fs.existsSync(fileFromUrl(good.body.data.company_logo))).toBe(true);
  });

  it("answers COMPANY_LOGO_INVALID in Arabic", async () => {
    const res = await uploadLogo(token, gif(), "logo.gif", "ar");
    expect(res.body).toEqual(errorBody("COMPANY_LOGO_INVALID", "ar"));
  });

  it("changes only the caller's company", async () => {
    const other = await createCompany();
    const res = await uploadLogo(token, png(1024));

    expect(res.body.data.id).toBe(owner.employer.id);
    expect((await db.Employer.findByPk(other.employer.id)).company_logo).toBeNull();
  });

  it("returns 401 without a token", async () => {
    const res = await uploadLogo(null, png(1024));
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("forbids a sub-admin even with every role flag", async () => {
    const role = await createAllFlagsRole(owner.employer);
    const person = await createLogin(owner.employer, "SUB_ADMIN", { role });

    const res = await uploadLogo(await loginAs(person.email), png(1024));

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    expect((await db.Employer.findByPk(owner.employer.id)).company_logo).toBeNull();
  });

  it.each(["EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])("forbids a %s", async (level) => {
    const person = await createLogin(owner.employer, level);
    const res = await uploadLogo(await loginAs(person.email), png(1024));
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });
});

describe("DELETE /api/company/logo", () => {
  let owner;
  let token;

  beforeEach(async () => {
    owner = await createCompany();
    token = await loginAs(owner.owner.email);
  });

  it("clears the logo and deletes the file", async () => {
    const uploaded = await uploadLogo(token, png(1024));
    const file = fileFromUrl(uploaded.body.data.company_logo);

    const res = await deleteLogo(token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(owner.employer.id);
    expect(res.body.data.company_logo).toBeNull();
    expect(fs.existsSync(file)).toBe(false);
    expect((await db.Employer.findByPk(owner.employer.id)).company_logo).toBeNull();
  });

  it("succeeds when there is no logo", async () => {
    const res = await deleteLogo(token);
    expect(res.status).toBe(200);
    expect(res.body.data.company_logo).toBeNull();
  });

  it("succeeds when the file is already gone", async () => {
    const uploaded = await uploadLogo(token, png(1024));
    fs.rmSync(fileFromUrl(uploaded.body.data.company_logo));

    const res = await deleteLogo(token);

    expect(res.status).toBe(200);
    expect(res.body.data.company_logo).toBeNull();
  });

  it("leaves another company's logo alone", async () => {
    const other = await createCompany();
    const otherToken = await loginAs(other.owner.email);
    const theirs = await uploadLogo(otherToken, png(1024));

    await deleteLogo(token);

    expect((await db.Employer.findByPk(other.employer.id)).company_logo).toBe(theirs.body.data.company_logo);
    expect(fs.existsSync(fileFromUrl(theirs.body.data.company_logo))).toBe(true);
  });

  it("returns 401 without a token", async () => {
    const res = await deleteLogo();
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("forbids a sub-admin even with every role flag, keeping the logo", async () => {
    const uploaded = await uploadLogo(token, png(1024));
    const role = await createAllFlagsRole(owner.employer);
    const person = await createLogin(owner.employer, "SUB_ADMIN", { role });

    const res = await deleteLogo(await loginAs(person.email));

    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
    expect(fs.existsSync(fileFromUrl(uploaded.body.data.company_logo))).toBe(true);
  });

  it.each(["EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"])("forbids a %s", async (level) => {
    const person = await createLogin(owner.employer, level);
    const res = await deleteLogo(await loginAs(person.email));
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });
});
