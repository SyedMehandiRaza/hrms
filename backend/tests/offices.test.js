const fs = require("fs");
const os = require("os");
const path = require("path");

const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-offices-"));
process.env.UPLOAD_DIR = UPLOAD_DIR;

const {
  app,
  db,
  SA,
  MISSING_ID,
  ISO,
  errorBody,
  validationBody,
  ownerCompany,
  loginFor,
  createEmployee,
  createOffice,
  createProject,
  assign,
  withAuth,
  api,
  NO_FLAGS,
} = require("./helpers/api");
const request = require("supertest");
const { seedId } = require("../src/utils/seed");

// Head offices API (ticket workforce#03; workforce D1–D6, ADR 0010; countries-cities-phones D7, D15–D19).

const PK = seedId("country:PK");
const RIYADH = seedId("city:Riyadh");
const READ = { can_read: true };
const ALL = { can_read: true, can_create: true, can_update: true, can_delete: true };

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  await db.sequelize.close();
});

const validBody = (overrides = {}) => ({
  name: "Riyadh HQ",
  email: "Riyadh@AlNoor.test",
  phone: "011 234 5678",
  phoneCountry: "SA",
  location: "King Fahd Road, Al Olaya, Riyadh",
  latitude: 24.7136,
  longitude: 46.6753,
  countryId: SA,
  cityId: RIYADH,
  ...overrides,
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const uploadImage = (token, id, buffer, filename = "photo.png") =>
  withAuth(request(app).put(`/api/offices/${id}/image`), token).attach("image", buffer, filename);
const fileFromUrl = (url) => path.join(UPLOAD_DIR, url.replace(/^\/uploads\//, ""));

describe("POST /api/offices", () => {
  it("creates an Unassigned head office with an E.164 phone, its country and city", async () => {
    const { token } = await ownerCompany();
    const res = await api.post("/api/offices", token, validBody());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        name: "Riyadh HQ",
        email: "riyadh@alnoor.test",
        phone: "+966112345678",
        phone_country: "SA",
        location: "King Fahd Road, Al Olaya, Riyadh",
        latitude: 24.7136,
        longitude: 46.6753,
        image: null,
        country: { id: SA, iso2: "SA", name: "Saudi Arabia" },
        city: { id: RIYADH, name: "Riyadh" },
        status: "UNASSIGNED",
        project: null,
        employee_count: 0,
        contract_employee_count: 0,
        created_at: ISO,
        updated_at: ISO,
      },
    });
  });

  it("names the country and city in Arabic when asked", async () => {
    const { token } = await ownerCompany();
    const res = await api.post("/api/offices", token, validBody(), { lang: "ar" });
    expect(res.body.data.country.name).toBe("السعودية");
    expect(res.body.data.city.name).toBe("الرياض");
  });

  it("lat/lng and city are optional", async () => {
    const { token } = await ownerCompany();
    const res = await api.post("/api/offices", token, validBody({ latitude: undefined, longitude: null, cityId: "" }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ latitude: null, longitude: null, city: null });
  });

  it("the same name again (any case) → 409 OFFICE_NAME_TAKEN", async () => {
    const { token } = await ownerCompany();
    await api.post("/api/offices", token, validBody());
    const res = await api.post("/api/offices", token, validBody({ name: "riyadh hq" }));
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("OFFICE_NAME_TAKEN"));
    expect(res.body.message).toBe("A head office with this name already exists.");
  });

  it("another company may use the same name", async () => {
    const a = await ownerCompany();
    const b = await ownerCompany();
    await api.post("/api/offices", a.token, validBody());
    expect((await api.post("/api/offices", b.token, validBody())).status).toBe(201);
  });

  it("reports every missing field at once", async () => {
    const { token } = await ownerCompany();
    const res = await api.post("/api/offices", token, {});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      validationBody({
        name: "officeNameRequired",
        email: "emailRequired",
        phone: "phoneNumberRequired",
        phoneCountry: "phoneCountryRequired",
        location: "locationRequired",
        countryId: "countryRequired",
      })
    );
  });

  it.each([
    ["name", { name: "   " }, "officeNameRequired"],
    ["name", { name: "A" }, "min2CharsRequired"],
    ["name", { name: "A".repeat(101) }, "officeNameMax"],
    ["name", { name: "Riyadh  HQ" }, "multipleSpaces"],
    ["name", { name: "Riyadh-HQ" }, "officeNameChars"],
    ["name", { name: "Riyadh HQ 😀" }, "officeNameChars"],
    ["email", { email: "not-an-email" }, "emailValidAddress"],
    ["phone", { phone: "12345" }, "phoneInvalidForCountry"],
    ["phoneCountry", { phoneCountry: "ZZ" }, "phoneCountryRequired"],
    ["location", { location: "Ab" }, "min3Chars"],
    ["location", { location: "A".repeat(256) }, "max255Allowed"],
    ["location", { location: "Riyadh #1" }, "locationFormat"],
    ["latitude", { latitude: 91 }, "latitudeInvalid"],
    ["latitude", { latitude: "north" }, "latitudeInvalid"],
    ["longitude", { longitude: -181 }, "longitudeInvalid"],
    ["countryId", { countryId: "nope" }, "countryRequired"],
    ["cityId", { countryId: PK }, "cityNotInCountry"],
    ["cityId", { cityId: "not-a-city" }, "cityNotInCountry"],
  ])("a bad %s (%j) → 400 with its §7.2 text", async (field, overrides, key) => {
    const { token } = await ownerCompany();
    const res = await api.post("/api/offices", token, validBody(overrides));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ [field]: key }));
  });

  it("accepts the boundaries: name 2 and 100 with apostrophes, location 3 and 255", async () => {
    const { token } = await ownerCompany();
    for (const overrides of [
      { name: "AB", location: "Abc" },
      { name: `O'Neil ${"N".repeat(93)}`, location: `${"L".repeat(250)}, R-1` },
    ]) {
      expect((await api.post("/api/offices", token, validBody(overrides))).status).toBe(201);
    }
  });

  it("answers field errors in Arabic", async () => {
    const { token } = await ownerCompany();
    const res = await api.post("/api/offices", token, validBody({ name: "A" }), { lang: "ar" });
    expect(res.body).toEqual(validationBody({ name: "min2CharsRequired" }, "ar"));
  });
});

describe("GET /api/offices", () => {
  it("lists the company's offices, newest first, with the four stats and per-office counts", async () => {
    const { employer, token } = await ownerCompany();
    const unassigned = await createOffice(employer, { office_name: "Dammam Branch", office_location: "Dammam Port" });
    const project = await createProject(employer, { project_name: "Jeddah Towers" });
    const busy = await db.Office.findByPk(project.office_id);
    await busy.update({ office_name: "Jeddah HQ", office_location: " dammam port " });
    // Counted: ACTIVE and IN_NOTICE with a current assignment (main or secondary).
    const fullTime = await createEmployee(employer);
    const contract = await createEmployee(employer, { employment_type: "CONTRACT", employment_status: "IN_NOTICE" });
    await assign(fullTime, project, { main: true });
    await assign(contract, project);
    // Not counted: exited, ended assignment, another company's employee.
    await assign(await createEmployee(employer, { employment_status: "EXITED" }), project);
    const ended = await assign(await createEmployee(employer), project);
    await ended.update({ is_active: false, end_date: "2026-05-01" });

    const res = await api.get("/api/offices", token);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.stats).toEqual({ total_offices: 2, active_offices: 1, total_locations: 1, total_projects: 1 });
    const byName = Object.fromEntries(res.body.data.items.map((o) => [o.name, o]));
    expect(byName["Jeddah HQ"]).toMatchObject({
      status: "ACTIVE",
      project: { id: project.id, name: "Jeddah Towers", code: project.project_code, status: "ACTIVE" },
      employee_count: 2,
      contract_employee_count: 1,
    });
    expect(byName["Dammam Branch"]).toMatchObject({ id: unassigned.id, status: "UNASSIGNED", project: null, employee_count: 0 });
  });

  it("searches name and location, filters by status, and pages", async () => {
    const { employer, token } = await ownerCompany();
    await createOffice(employer, { office_name: "Alpha Office", office_location: "North Riyadh" });
    await createOffice(employer, { office_name: "Beta Office", office_location: "Jeddah Corniche" });
    await createProject(employer);

    expect((await api.get("/api/offices", token, { query: { search: "alpha" } })).body.data.items.map((o) => o.name)).toEqual(["Alpha Office"]);
    expect((await api.get("/api/offices", token, { query: { search: "corniche" } })).body.data.items.map((o) => o.name)).toEqual(["Beta Office"]);
    expect((await api.get("/api/offices", token, { query: { status: "ACTIVE" } })).body.data.total).toBe(1);
    expect((await api.get("/api/offices", token, { query: { status: "UNASSIGNED" } })).body.data.total).toBe(2);
    const page = (await api.get("/api/offices", token, { query: { page: 2, limit: 2 } })).body.data;
    expect(page).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(page.items).toHaveLength(1);
  });

  it.each([["status=OPEN"], ["page=0"], ["limit=101"]])("a bad query (%s) → 400 VALIDATION_FAILED", async (q) => {
    const { token } = await ownerCompany();
    const res = await request(app).get(`/api/offices?${q}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("never shows another company's offices or counts them", async () => {
    const mine = await ownerCompany();
    const other = await ownerCompany();
    await createOffice(other.employer);
    await createProject(other.employer);
    const res = await api.get("/api/offices", mine.token);
    expect(res.body.data).toMatchObject({ items: [], total: 0 });
    expect(res.body.data.stats).toEqual({ total_offices: 0, active_offices: 0, total_locations: 0, total_projects: 0 });
  });
});

describe("GET /api/offices/:id", () => {
  it("shows the project's name for an office that has one", async () => {
    const { employer, token } = await ownerCompany();
    const project = await createProject(employer, { project_name: "King Salman Park" });
    const res = await api.get(`/api/offices/${project.office_id}`, token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "ACTIVE", project: { name: "King Salman Park" } });
  });

  it.each([MISSING_ID, "not-a-uuid"])("an unknown id (%s) → 404 NOT_FOUND", async (id) => {
    const { token } = await ownerCompany();
    const res = await api.get(`/api/offices/${id}`, token);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it("another company's office → 404 NOT_FOUND", async () => {
    const mine = await ownerCompany();
    const other = await ownerCompany();
    const theirs = await createOffice(other.employer);
    const res = await api.get(`/api/offices/${theirs.id}`, mine.token);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("The requested record was not found.");
  });
});

describe("PUT /api/offices/:id", () => {
  it("saves every field; omitted optional fields keep their values", async () => {
    const { token } = await ownerCompany();
    const created = (await api.post("/api/offices", token, validBody())).body.data;
    const res = await api.put(`/api/offices/${created.id}`, token, {
      name: "Riyadh Main",
      email: "main@alnoor.test",
      phone: "+919876543210",
      phoneCountry: "IN",
      location: "Olaya Street, Riyadh",
      countryId: SA,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: "Riyadh Main",
      phone: "+919876543210",
      phone_country: "IN",
      latitude: 24.7136,
      city: { id: RIYADH },
    });
  });

  it("an explicit null clears lat/lng and the city", async () => {
    const { token } = await ownerCompany();
    const created = (await api.post("/api/offices", token, validBody())).body.data;
    const res = await api.put(`/api/offices/${created.id}`, token, validBody({ latitude: null, longitude: null, cityId: null }));
    expect(res.body.data).toMatchObject({ latitude: null, longitude: null, city: null });
  });

  it("keeping its own name is fine; taking another office's name → 409 OFFICE_NAME_TAKEN", async () => {
    const { token } = await ownerCompany();
    const a = (await api.post("/api/offices", token, validBody())).body.data;
    await api.post("/api/offices", token, validBody({ name: "Jeddah HQ" }));
    expect((await api.put(`/api/offices/${a.id}`, token, validBody({ name: "RIYADH HQ" }))).status).toBe(200);
    const res = await api.put(`/api/offices/${a.id}`, token, validBody({ name: "jeddah hq" }));
    expect(res.body).toEqual(errorBody("OFFICE_NAME_TAKEN"));
  });

  it("changing the country to one without that city → cityId error", async () => {
    const { token } = await ownerCompany();
    const a = (await api.post("/api/offices", token, validBody())).body.data;
    const body = validBody({ countryId: PK });
    delete body.cityId;
    const res = await api.put(`/api/offices/${a.id}`, token, body);
    expect(res.body).toEqual(validationBody({ cityId: "cityNotInCountry" }));
  });

  it("another company's office → 404", async () => {
    const mine = await ownerCompany();
    const other = await ownerCompany();
    const theirs = await createOffice(other.employer);
    expect((await api.put(`/api/offices/${theirs.id}`, mine.token, validBody())).status).toBe(404);
  });
});

describe("DELETE /api/offices/:id", () => {
  it("deletes an Unassigned office; its name can be reused", async () => {
    const { token } = await ownerCompany();
    const a = (await api.post("/api/offices", token, validBody())).body.data;
    const res = await api.delete(`/api/offices/${a.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: a.id } });
    expect((await api.get(`/api/offices/${a.id}`, token)).status).toBe(404);
    expect(await db.Office.findByPk(a.id, { paranoid: false })).not.toBeNull();
    expect((await api.post("/api/offices", token, validBody())).status).toBe(201);
  });

  it("an office with a project → 409 OFFICE_IN_USE", async () => {
    const { employer, token } = await ownerCompany();
    const project = await createProject(employer);
    const res = await api.delete(`/api/offices/${project.office_id}`, token);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("OFFICE_IN_USE"));
    expect(res.body.message).toBe("This head office has a project and can't be deleted.");
  });
});

describe("office image", () => {
  it("stores a JPG or PNG up to 2 MB, returns its URL, and deletes the old file when replaced", async () => {
    const { token } = await ownerCompany();
    const a = (await api.post("/api/offices", token, validBody())).body.data;
    const first = await uploadImage(token, a.id, PNG);
    expect(first.status).toBe(200);
    expect(first.body.data.image).toMatch(/^\/uploads\/offices\/[0-9a-f-]{36}\.png$/);
    expect(fs.existsSync(fileFromUrl(first.body.data.image))).toBe(true);

    const second = await uploadImage(token, a.id, JPG, "photo.jpg");
    expect(second.body.data.image).toMatch(/\.jpg$/);
    expect(fs.existsSync(fileFromUrl(first.body.data.image))).toBe(false);

    const exact = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 - PNG.length)]);
    expect((await uploadImage(token, a.id, exact)).status).toBe(200);
  });

  it("DELETE removes it (and its file); with no image it's still 200", async () => {
    const { token } = await ownerCompany();
    const a = (await api.post("/api/offices", token, validBody())).body.data;
    const url = (await uploadImage(token, a.id, PNG)).body.data.image;
    const res = await api.delete(`/api/offices/${a.id}/image`, token);
    expect(res.status).toBe(200);
    expect(res.body.data.image).toBeNull();
    expect(fs.existsSync(fileFromUrl(url))).toBe(false);
    expect((await api.delete(`/api/offices/${a.id}/image`, token)).status).toBe(200);
  });

  it.each([
    ["a text file", Buffer.from("not an image"), "photo.png"],
    ["a GIF", Buffer.from("GIF89a................"), "photo.gif"],
    ["over 2 MB", Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), "big.png"],
  ])("%s → 400 OFFICE_IMAGE_INVALID", async (_label, buffer, filename) => {
    const { token } = await ownerCompany();
    const a = (await api.post("/api/offices", token, validBody())).body.data;
    const res = await uploadImage(token, a.id, buffer, filename);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("OFFICE_IMAGE_INVALID"));
    expect(res.body.message).toBe("Image must be a JPG or PNG up to 2 MB.");
  });

  it("no file → 400 OFFICE_IMAGE_INVALID", async () => {
    const { token } = await ownerCompany();
    const a = (await api.post("/api/offices", token, validBody())).body.data;
    const res = await withAuth(request(app).put(`/api/offices/${a.id}/image`), token);
    expect(res.body).toEqual(errorBody("OFFICE_IMAGE_INVALID"));
  });

  it("another company's office → 404", async () => {
    const mine = await ownerCompany();
    const other = await ownerCompany();
    const theirs = await createOffice(other.employer);
    expect((await uploadImage(mine.token, theirs.id, PNG)).status).toBe(404);
  });
});

describe("authentication and permissions", () => {
  it("no token → 401 AUTH_REQUIRED", async () => {
    const res = await api.get("/api/offices", null);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it.each([
    ["GET /", () => ["get", "/api/offices"]],
    ["POST /", () => ["post", "/api/offices"]],
    ["GET /:id", (id) => ["get", `/api/offices/${id}`]],
    ["PUT /:id", (id) => ["put", `/api/offices/${id}`]],
    ["DELETE /:id", (id) => ["delete", `/api/offices/${id}`]],
    ["DELETE /:id/image", (id) => ["delete", `/api/offices/${id}/image`]],
  ])("a role with no office flags → 403 FORBIDDEN on %s", async (_label, route) => {
    const { employer } = await ownerCompany();
    const office = await createOffice(employer);
    const { token } = await loginFor(employer, "SUB_ADMIN", { office: NO_FLAGS });
    const [method, url] = route(office.id);
    const res = method === "get" || method === "delete" ? await api[method](url, token) : await api[method](url, token, validBody());
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("a login with no role → 403", async () => {
    const { employer } = await ownerCompany();
    const { token } = await loginFor(employer, "EMPLOYEE");
    expect((await api.get("/api/offices", token)).status).toBe(403);
  });

  it("read-only: may list and view, may not create, edit, delete or change the image", async () => {
    const { employer } = await ownerCompany();
    const office = await createOffice(employer);
    const { token } = await loginFor(employer, "SUB_ADMIN", { office: READ });
    expect((await api.get("/api/offices", token)).status).toBe(200);
    expect((await api.get(`/api/offices/${office.id}`, token)).status).toBe(200);
    expect((await api.post("/api/offices", token, validBody())).status).toBe(403);
    expect((await api.put(`/api/offices/${office.id}`, token, validBody())).status).toBe(403);
    expect((await api.delete(`/api/offices/${office.id}`, token)).status).toBe(403);
    expect((await uploadImage(token, office.id, PNG)).status).toBe(403);
  });

  it.each(["SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE"])("%s with every office flag can do everything", async (level) => {
    const { employer } = await ownerCompany();
    const { token } = await loginFor(employer, level, { office: ALL });
    const created = await api.post("/api/offices", token, validBody());
    expect(created.status).toBe(201);
    expect((await api.put(`/api/offices/${created.body.data.id}`, token, validBody({ name: "Renamed HQ" }))).status).toBe(200);
    expect((await api.delete(`/api/offices/${created.body.data.id}`, token)).status).toBe(200);
  });

  it("a staffing-company login → 403 even with every office flag", async () => {
    const { employer } = await ownerCompany();
    const { token } = await loginFor(employer, "STAFFING_COMPANY", { office: ALL });
    const res = await api.get("/api/offices", token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(errorBody("FORBIDDEN"));
  });

  it("answers 403 in Arabic", async () => {
    const { employer } = await ownerCompany();
    const { token } = await loginFor(employer, "SUB_ADMIN", { office: NO_FLAGS });
    expect((await api.get("/api/offices", token, { lang: "ar" })).body).toEqual(errorBody("FORBIDDEN", "ar"));
  });
});
