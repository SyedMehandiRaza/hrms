const fs = require("fs");
const os = require("os");
const path = require("path");

const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hrms-projects-"));
process.env.UPLOAD_DIR = UPLOAD_DIR;

const request = require("supertest");
const {
  app,
  db,
  SA,
  MISSING_ID,
  errorBody,
  validationBody,
  ownerCompany,
  createCompany,
  createFinancialYear,
  loginAs,
  loginFor,
  createEmployee,
  createOffice,
  createProject,
  assign,
  withAuth,
  api,
  NO_FLAGS,
} = require("./helpers/api");
const { seedId } = require("../src/utils/seed");
const { clock } = require("../src/utils/clock");

// Projects API (ticket workforce#04; workforce D6–D12, D16, ADR 0010).

const PK = seedId("country:PK");
const RIYADH = seedId("city:Riyadh");
const YEAR = new Date().getUTCFullYear();
const YY = String(YEAR).slice(-2);
const ALL = { can_read: true, can_create: true, can_update: true, can_delete: true };

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  await db.sequelize.close();
});

const body = (officeId, overrides = {}) => ({
  name: "King Salman Park",
  officeId,
  startDate: `${YEAR}-01-01`,
  endDate: `${YEAR + 1}-06-30`,
  location: "Al Malaz, Riyadh",
  latitude: 24.6877,
  longitude: 46.7219,
  radius: 250,
  allowOfflineAttendance: false,
  description: "Phase 2 landscaping",
  countryId: SA,
  cityId: RIYADH,
  ...overrides,
});

// A company owner and one Unassigned office.
const setup = async () => {
  const company = await ownerCompany();
  const office = await createOffice(company.employer);
  return { ...company, office };
};
const create = async ({ token, employer }, overrides = {}) => {
  const office = await createOffice(employer);
  const res = await api.post("/api/projects", token, body(office.id, overrides));
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.data;
};

describe("POST /api/projects", () => {
  it("creates a project on an Unassigned head office with a server code PRJ-FY{yy}-0001, then 0002", async () => {
    const ctx = await setup();
    const res = await api.post("/api/projects", ctx.token, body(ctx.office.id, { code: "MINE-1" }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "King Salman Park",
      code: `PRJ-FY${YY}-0001`,
      description: "Phase 2 landscaping",
      location: "Al Malaz, Riyadh",
      latitude: 24.6877,
      longitude: 46.7219,
      radius: 250,
      allow_offline_attendance: false,
      start_date: `${YEAR}-01-01`,
      end_date: `${YEAR + 1}-06-30`,
      status: "ACTIVE",
      photo: null,
      office: { id: ctx.office.id, name: ctx.office.office_name, location: ctx.office.office_location },
      country: { id: SA, iso2: "SA", name: "Saudi Arabia" },
      city: { id: RIYADH, name: "Riyadh" },
      employee_count: 0,
      contract_employee_count: 0,
    });
    const second = await create(ctx, { name: "Second Project" });
    expect(second.code).toBe(`PRJ-FY${YY}-0002`);
  });

  it("each company has its own sequence", async () => {
    const a = await setup();
    const b = await setup();
    await create(a);
    expect((await create(b)).code).toBe(`PRJ-FY${YY}-0001`);
  });

  it("skips a code that's already used", async () => {
    const ctx = await setup();
    await createProject(ctx.employer, { project_code: `PRJ-FY${YY}-0001` });
    expect((await create(ctx)).code).toBe(`PRJ-FY${YY}-0002`);
  });

  it("an April–March company creating a project in February 2027 gets PRJ-FY26-…", async () => {
    const company = await createCompany();
    await db.CompanyTimeSetting.update({ fy_start_month: 4 }, { where: { employer_id: company.employer.id } });
    await db.FinancialYear.destroy({ where: { employer_id: company.employer.id } });
    await createFinancialYear(company.employer, 2026, { label: "FY 2026-27", start_date: "2026-04-01", end_date: "2027-03-31" });
    const token = await loginAs(company.owner.email);
    jest.spyOn(clock, "now").mockReturnValue(new Date("2027-02-10T09:00:00Z"));
    const office = await createOffice(company.employer);
    const res = await api.post("/api/projects", token, body(office.id));
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe("PRJ-FY26-0001");
  });

  it("defaults: offline attendance allowed, ACTIVE; a status can be chosen", async () => {
    const ctx = await setup();
    const res = await api.post("/api/projects", ctx.token, body(ctx.office.id, { allowOfflineAttendance: undefined, status: "ON_HOLD" }));
    expect(res.body.data).toMatchObject({ allow_offline_attendance: true, status: "ON_HOLD" });
  });

  it("an office that already has a project → 409 PROJECT_OFFICE_TAKEN", async () => {
    const ctx = await setup();
    await api.post("/api/projects", ctx.token, body(ctx.office.id));
    const res = await api.post("/api/projects", ctx.token, body(ctx.office.id, { name: "Other" }));
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("PROJECT_OFFICE_TAKEN"));
    expect(res.body.message).toBe("This head office already has a project.");
  });

  it("a duplicate name (any case) → 409 PROJECT_NAME_TAKEN", async () => {
    const ctx = await setup();
    await create(ctx);
    const res = await api.post("/api/projects", ctx.token, body(ctx.office.id, { name: "king salman PARK" }));
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("PROJECT_NAME_TAKEN"));
  });

  it("reports every missing field at once", async () => {
    const ctx = await setup();
    const res = await api.post("/api/projects", ctx.token, {});
    expect(res.body).toEqual(
      validationBody({
        name: "projectNameRequired",
        officeId: "officeSelect",
        startDate: "startDateRequired",
        endDate: "endDateRequired",
        location: "mapLocationRequired",
        latitude: "mapLocationRequired",
        longitude: "mapLocationRequired",
        radius: "radiusRequired",
        countryId: "countryRequired",
      })
    );
  });

  it.each([
    ["name", { name: "A" }, "min2CharsRequired"],
    ["name", { name: "N".repeat(256) }, "projectNameMax"],
    ["name", { name: "King  Park" }, "multipleSpaces"],
    ["name", { name: "King Park 😀" }, "invalidCharsUsed"],
    ["name", { name: "Park <script>" }, "invalidCharsUsed"],
    ["endDate", { startDate: `${YEAR}-06-01`, endDate: `${YEAR}-05-31` }, "endAfterStart"],
    ["startDate", { startDate: `${YEAR}-13-01` }, "startDateRequired"],
    ["radius", { radius: 49 }, "radiusMin"],
    ["radius", { radius: 100001 }, "radiusMax"],
    ["radius", { radius: "far" }, "radiusRequired"],
    ["description", { description: "D".repeat(1001) }, "descriptionMax1000"],
    ["latitude", { latitude: 95 }, "mapLocationRequired"],
    ["status", { status: "INACTIVE" }, "statusChangeNotAllowed"],
    ["cityId", { countryId: PK }, "cityNotInCountry"],
    ["officeId", { officeId: MISSING_ID }, "officeSelect"],
  ])("a bad %s (%j) → 400 with its §7.2 text", async (field, overrides, key) => {
    const ctx = await setup();
    const res = await api.post("/api/projects", ctx.token, body(ctx.office.id, overrides));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ [field]: key }));
  });

  it("accepts Arabic names, the punctuation the UI allows, equal start and end, and radius 50 / 100000", async () => {
    const ctx = await setup();
    for (const overrides of [
      { name: "مشروع الرياض", startDate: `${YEAR}-03-01`, endDate: `${YEAR}-03-01`, radius: 50 },
      { name: "Tower A&B (Phase 1/2): Lot #3, O'Neil's.", radius: 100000 },
    ]) {
      const office = await createOffice(ctx.employer);
      expect((await api.post("/api/projects", ctx.token, body(office.id, overrides))).status).toBe(201);
    }
  });

  it("another company's office → officeId error", async () => {
    const ctx = await setup();
    const other = await createCompany();
    const theirs = await createOffice(other.employer);
    expect((await api.post("/api/projects", ctx.token, body(theirs.id))).body).toEqual(validationBody({ officeId: "officeSelect" }));
  });
});

describe("PUT /api/projects/:id", () => {
  it("saves the fields; a code sent by the client is ignored and the code never changes", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const res = await api.put(`/api/projects/${p.id}`, ctx.token, body(p.office.id, { name: "Renamed Park", code: "X-1", radius: 500 }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Renamed Park", code: p.code, radius: 500 });
  });

  it("moves to another Unassigned office; a taken one → 409 PROJECT_OFFICE_TAKEN", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const q = await create(ctx, { name: "Second" });
    const free = await createOffice(ctx.employer);
    expect((await api.put(`/api/projects/${p.id}`, ctx.token, body(free.id))).body.data.office.id).toBe(free.id);
    const res = await api.put(`/api/projects/${p.id}`, ctx.token, body(q.office.id));
    expect(res.body).toEqual(errorBody("PROJECT_OFFICE_TAKEN"));
  });

  it("moving the start after an assignment's start → 409 PROJECT_START_AFTER_ASSIGNMENTS; up to it is fine", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const project = await db.Project.findByPk(p.id);
    await assign(await createEmployee(ctx.employer), project, { start: `${YEAR}-03-01` });
    const late = await api.put(`/api/projects/${p.id}`, ctx.token, body(p.office.id, { startDate: `${YEAR}-03-02` }));
    expect(late.status).toBe(409);
    expect(late.body).toEqual(errorBody("PROJECT_START_AFTER_ASSIGNMENTS"));
    expect(late.body.message).toBe("Some employees were assigned before this date.");
    expect((await api.put(`/api/projects/${p.id}`, ctx.token, body(p.office.id, { startDate: `${YEAR}-03-01` }))).status).toBe(200);
  });

  it("a status in the edit follows the same rules", async () => {
    const ctx = await setup();
    const p = await create(ctx, { status: "COMPLETED" });
    const res = await api.put(`/api/projects/${p.id}`, ctx.token, body(p.office.id, { status: "ON_HOLD" }));
    expect(res.body).toEqual(validationBody({ status: "statusChangeNotAllowed" }));
    expect((await api.put(`/api/projects/${p.id}`, ctx.token, body(p.office.id, { status: "ACTIVE" }))).body.data.status).toBe("ACTIVE");
  });

  it("omitted description and city keep their values; null clears them", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const keep = body(p.office.id);
    delete keep.description;
    delete keep.cityId;
    expect((await api.put(`/api/projects/${p.id}`, ctx.token, keep)).body.data).toMatchObject({ description: "Phase 2 landscaping", city: { id: RIYADH } });
    const cleared = await api.put(`/api/projects/${p.id}`, ctx.token, body(p.office.id, { description: null, cityId: null }));
    expect(cleared.body.data).toMatchObject({ description: null, city: null });
  });

  it("passing the end date doesn't change the status", async () => {
    const ctx = await setup();
    const p = await create(ctx, { startDate: "2020-01-01", endDate: "2020-12-31" });
    expect(p.status).toBe("ACTIVE");
    expect((await api.get(`/api/projects/${p.id}`, ctx.token)).body.data.status).toBe("ACTIVE");
  });
});

describe("PATCH /api/projects/:id/status", () => {
  const patch = (ctx, id, status) => api.patch(`/api/projects/${id}/status`, ctx.token, { status });

  it.each([
    ["ACTIVE", "ON_HOLD"],
    ["ACTIVE", "COMPLETED"],
    ["ON_HOLD", "ACTIVE"],
    ["ON_HOLD", "COMPLETED"],
    ["COMPLETED", "ACTIVE"],
  ])("%s → %s succeeds", async (from, to) => {
    const ctx = await setup();
    const p = await create(ctx, { status: from });
    const res = await patch(ctx, p.id, to);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(to);
  });

  it.each([["COMPLETED", "ON_HOLD"], ["ACTIVE", "PAUSED"], ["ACTIVE", ""]])("%s → %j → 400 status 'This status change isn't allowed.'", async (from, to) => {
    const ctx = await setup();
    const p = await create(ctx, { status: from });
    const res = await patch(ctx, p.id, to);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(validationBody({ status: "statusChangeNotAllowed" }));
  });

  it("the same status again is no change", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    expect((await patch(ctx, p.id, "ACTIVE")).status).toBe(200);
  });

  it.each(["ACTIVE", "IN_NOTICE"])("COMPLETED while an %s employee has it as main project → 409 PROJECT_HAS_EMPLOYEES", async (employmentStatus) => {
    const ctx = await setup();
    const p = await create(ctx);
    await assign(await createEmployee(ctx.employer, { employment_status: employmentStatus }), await db.Project.findByPk(p.id), { main: true });
    const res = await patch(ctx, p.id, "COMPLETED");
    expect(res.status).toBe(409);
    expect(res.body).toEqual(errorBody("PROJECT_HAS_EMPLOYEES"));
    expect(res.body.message).toBe("Move this project's employees to another main project before completing it.");
  });

  it("an exited employee's main assignment doesn't block COMPLETED", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    await assign(await createEmployee(ctx.employer, { employment_status: "EXITED" }), await db.Project.findByPk(p.id), { main: true });
    expect((await patch(ctx, p.id, "COMPLETED")).status).toBe(200);
  });

  it("COMPLETED ends the secondary assignments today with REMOVED history rows; reopening doesn't restore them", async () => {
    const ctx = await setup();
    jest.spyOn(clock, "now").mockReturnValue(new Date(`${YEAR}-10-20T20:30:00Z`)); // 23:30 in Riyadh
    const p = await create(ctx);
    const project = await db.Project.findByPk(p.id);
    const a = await createEmployee(ctx.employer);
    const b = await createEmployee(ctx.employer, { employment_type: "CONTRACT" });
    const ra = await assign(a, project);
    const rb = await assign(b, project);

    expect((await patch(ctx, p.id, "COMPLETED")).status).toBe(200);
    await Promise.all([ra.reload(), rb.reload()]);
    expect([ra.is_active, ra.end_date]).toEqual([false, `${YEAR}-10-20`]);
    expect([rb.is_active, rb.end_date]).toEqual([false, `${YEAR}-10-20`]);
    const history = await db.EmployeeProjectHistory.findAll({ where: { project_id: p.id }, raw: true });
    expect(history).toHaveLength(2);
    history.forEach((h) => expect(h).toMatchObject({ action: "REMOVED", effective_date: `${YEAR}-10-20`, actioned_by: ctx.owner.id }));

    expect((await patch(ctx, p.id, "ACTIVE")).body.data.employee_count).toBe(0);
    expect((await ra.reload()).is_active).toBe(false);
  });

  it("ON_HOLD is allowed with employees still assigned (they stay)", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const row = await assign(await createEmployee(ctx.employer), await db.Project.findByPk(p.id), { main: true });
    const res = await patch(ctx, p.id, "ON_HOLD");
    expect(res.status).toBe(200);
    expect(res.body.data.employee_count).toBe(1);
    expect((await row.reload()).is_active).toBe(true);
  });
});

describe("project photo", () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
  const upload = (token, id, buffer, name = "p.png") => withAuth(request(app).put(`/api/projects/${id}/image`), token).attach("image", buffer, name);

  it("stores a JPG/PNG up to 2 MB, replaces the old file, and DELETE removes it", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const first = await upload(ctx.token, p.id, PNG);
    expect(first.status).toBe(200);
    expect(first.body.data.photo).toMatch(/^\/uploads\/projects\/[0-9a-f-]{36}\.png$/);
    const firstFile = path.join(UPLOAD_DIR, first.body.data.photo.replace(/^\/uploads\//, ""));
    expect(fs.existsSync(firstFile)).toBe(true);
    await upload(ctx.token, p.id, PNG);
    expect(fs.existsSync(firstFile)).toBe(false);
    const removed = await api.delete(`/api/projects/${p.id}/image`, ctx.token);
    expect(removed.body.data.photo).toBeNull();
  });

  it.each([
    ["text", Buffer.from("hello")],
    ["over 2 MB", Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])],
  ])("%s → 400 PROJECT_IMAGE_INVALID", async (_label, buffer) => {
    const ctx = await setup();
    const p = await create(ctx);
    const res = await upload(ctx.token, p.id, buffer);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorBody("PROJECT_IMAGE_INVALID"));
    expect(res.body.message).toBe("Image must be a JPG or PNG up to 2 MB.");
  });
});

describe("GET /api/projects/office-options", () => {
  it("lists only Unassigned head offices, plus the project's own one when editing", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const free = ctx.office;
    const plain = (await api.get("/api/projects/office-options", ctx.token)).body.data.map((o) => o.id);
    expect(plain).toEqual([free.id]);
    const editing = (await api.get("/api/projects/office-options", ctx.token, { query: { projectId: p.id } })).body.data.map((o) => o.id);
    expect(editing.sort()).toEqual([free.id, p.office.id].sort());
  });

  it("another company's project id → 404", async () => {
    const ctx = await setup();
    const other = await createCompany();
    const theirs = await createProject(other.employer);
    expect((await api.get("/api/projects/office-options", ctx.token, { query: { projectId: theirs.id } })).status).toBe(404);
  });
});

describe("GET /api/projects", () => {
  it("lists with search by name, code or location, a status filter, stats and counts; detail includes the office", async () => {
    const ctx = await setup();
    const a = await create(ctx, { name: "Alpha Tower", location: "North Riyadh" });
    await create(ctx, { name: "Beta Park", location: "Jeddah Corniche", status: "ON_HOLD" });
    await create(ctx, { name: "Gamma Mall", status: "COMPLETED" });
    const project = await db.Project.findByPk(a.id);
    await assign(await createEmployee(ctx.employer), project, { main: true });
    await assign(await createEmployee(ctx.employer, { employment_type: "CONTRACT", employment_status: "IN_NOTICE" }), project);

    const all = (await api.get("/api/projects", ctx.token)).body.data;
    expect(all.total).toBe(3);
    expect(all.stats).toEqual({ total_projects: 3, active_projects: 1, on_hold_projects: 1, completed_projects: 1, total_employees: 2 });
    expect(all.items.find((p) => p.id === a.id)).toMatchObject({ employee_count: 2, contract_employee_count: 1 });

    const names = async (query) => (await api.get("/api/projects", ctx.token, { query })).body.data.items.map((p) => p.name);
    expect(await names({ search: "alpha" })).toEqual(["Alpha Tower"]);
    expect(await names({ search: a.code })).toEqual(["Alpha Tower"]);
    expect(await names({ search: "corniche" })).toEqual(["Beta Park"]);
    expect(await names({ status: "COMPLETED" })).toEqual(["Gamma Mall"]);

    const detail = (await api.get(`/api/projects/${a.id}`, ctx.token)).body.data;
    expect(detail.office).toEqual({ id: a.office.id, name: a.office.name, location: a.office.location });
  });

  it("never shows another company's projects", async () => {
    const ctx = await setup();
    const other = await createCompany();
    const theirs = await createProject(other.employer);
    expect((await api.get("/api/projects", ctx.token)).body.data.total).toBe(0);
    expect((await api.get(`/api/projects/${theirs.id}`, ctx.token)).body).toEqual(errorBody("NOT_FOUND"));
    expect((await api.patch(`/api/projects/${theirs.id}/status`, ctx.token, { status: "ON_HOLD" })).status).toBe(404);
  });
});

describe("authentication and permissions", () => {
  it("no token → 401", async () => {
    expect((await api.get("/api/projects", null)).body).toEqual(errorBody("AUTH_REQUIRED"));
  });

  it("no project flags → 403 on every route", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", { project: NO_FLAGS });
    for (const res of [
      await api.get("/api/projects", token),
      await api.get(`/api/projects/${p.id}`, token),
      await api.get("/api/projects/office-options", token),
      await api.post("/api/projects", token, body(ctx.office.id)),
      await api.put(`/api/projects/${p.id}`, token, body(p.office.id)),
      await api.patch(`/api/projects/${p.id}/status`, token, { status: "ON_HOLD" }),
      await api.delete(`/api/projects/${p.id}/image`, token),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body).toEqual(errorBody("FORBIDDEN"));
    }
  });

  it("read only: lists and views every project, can't create or change", async () => {
    const ctx = await setup();
    const p = await create(ctx);
    const { token } = await loginFor(ctx.employer, "EMPLOYEE", { project: { can_read: true } });
    expect((await api.get("/api/projects", token)).body.data.total).toBe(1);
    expect((await api.get(`/api/projects/${p.id}`, token)).status).toBe(200);
    expect((await api.post("/api/projects", token, body(ctx.office.id))).status).toBe(403);
    expect((await api.patch(`/api/projects/${p.id}/status`, token, { status: "ON_HOLD" })).status).toBe(403);
  });

  it("a SUB_ADMIN with every project flag manages projects", async () => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, "SUB_ADMIN", { project: ALL });
    const res = await api.post("/api/projects", token, body(ctx.office.id));
    expect(res.status).toBe(201);
    expect((await api.patch(`/api/projects/${res.body.data.id}/status`, token, { status: "ON_HOLD" })).status).toBe(200);
  });

  it("a staffing-company login → 403 even with every project flag", async () => {
    const ctx = await setup();
    const { token } = await loginFor(ctx.employer, "STAFFING_COMPANY", { project: ALL });
    expect((await api.get("/api/projects", token)).body).toEqual(errorBody("FORBIDDEN"));
  });
});
