const request = require("supertest");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const { seedId } = require("../src/utils/seed");
const {
  CITY_COUNTRIES,
  LEGACY_CITY_GEONAMES,
  COMPANY_COUNTRY_ID,
  loadGeoReference,
  matchCountryByName,
  matchCityByName,
} = require("../src/utils/geoReference");
const { backfill } = require("../src/migrations/20261020500003-geo-links");

// Country and city reference data + the new links (ticket geo#01; countries-cities-phones D1–D5, D11–D13, §3).

const countriesJson = require("../src/data/geo/countries.json");
const citiesJson = require("../src/data/geo/cities.json");

afterAll(async () => {
  await db.sequelize.close();
});

const count = (sql) =>
  db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT }).then(([row]) => Number(Object.values(row)[0]));

describe("reference data (D1–D3)", () => {
  it("loads every country from the data file, all active, each with codes, names and a flag", async () => {
    // Other test files add factory rows (digit-only codes); only the reference rows count here.
    const rows = await db.Country.findAll({ where: { iso2: countriesJson.map((c) => c.iso2) }, raw: true });
    expect(rows.length).toBe(countriesJson.length);
    expect(rows.length).toBeGreaterThanOrEqual(240);
    rows.forEach((c) => {
      expect(c.is_active).toBeTruthy();
      expect(c.iso2).toMatch(/^[A-Z]{2}$/);
      expect(c.iso3).toMatch(/^[A-Z]{3}$/);
      expect(c.calling_code).toMatch(/^\+\d{1,4}$/);
      expect(c.name).toBeTruthy();
      expect(c.name_ar).toBeTruthy();
      expect(c.flag).toBeTruthy();
    });
  });

  it.each([
    ["SA", "Saudi Arabia", "+966", "السعودية"],
    ["IN", "India", "+91", "الهند"],
    ["PK", "Pakistan", "+92", "باكستان"],
    ["US", "United States of America", "+1", "الولايات المتحدة"],
    ["CA", "Canada", "+1", "كندا"],
  ])("%s is %s (%s)", async (iso2, name, code, ar) => {
    const c = await db.Country.findOne({ where: { iso2 } });
    expect(c.name).toBe(name);
    expect(c.calling_code).toBe(code);
    expect(c.name_ar).toBe(ar);
    expect(c.id).toBe(seedId(`country:${iso2}`));
  });

  it("loads cities only for the GCC and labour-source countries, each of which has some", async () => {
    const perCountry = await db.sequelize.query(
      "SELECT co.iso2, COUNT(*) AS n FROM cities ci JOIN countries co ON co.id = ci.country_id WHERE ci.geoname_id IS NOT NULL GROUP BY co.iso2",
      { type: db.sequelize.QueryTypes.SELECT }
    );
    const isos = perCountry.map((r) => r.iso2).sort();
    expect(isos).toEqual([...CITY_COUNTRIES].sort());
    perCountry.forEach((r) => expect(Number(r.n)).toBeGreaterThan(0));
    expect(await db.City.count({ where: { geoname_id: { [db.Sequelize.Op.ne]: null } } })).toBe(citiesJson.length);
  });

  it("has no cities for other countries (e.g. France)", async () => {
    const fr = await db.Country.findOne({ where: { iso2: "FR" } });
    expect(await db.City.count({ where: { country_id: fr.id } })).toBe(0);
  });

  it.each(Object.entries(LEGACY_CITY_GEONAMES))("keeps the first seed's id for %s", async (key, geonameId) => {
    const city = await db.City.findOne({ where: { geoname_id: geonameId } });
    expect(city.id).toBe(seedId(`city:${key}`));
    expect(city.country_id).toBe(seedId("country:SA"));
  });

  it("stores Arabic city names where GeoNames has one", async () => {
    const riyadh = await db.City.findOne({ where: { geoname_id: LEGACY_CITY_GEONAMES.Riyadh } });
    expect(riyadh.city_name).toBe("Riyadh");
    expect(riyadh.name_ar).toBe("الرياض");
  });

  it("re-running the load adds nothing and keeps ids", async () => {
    const before = await count("SELECT COUNT(*) FROM cities");
    const riyadh = await db.City.findOne({ where: { geoname_id: LEGACY_CITY_GEONAMES.Riyadh } });
    const result = await loadGeoReference(db.sequelize);
    expect(result.countriesAdded).toBe(0);
    expect(result.citiesAdded).toBe(0);
    expect(await count("SELECT COUNT(*) FROM cities")).toBe(before);
    expect((await db.City.findOne({ where: { geoname_id: LEGACY_CITY_GEONAMES.Riyadh } })).id).toBe(riyadh.id);
  });

  it("never deletes: a city that isn't in the file survives a re-run", async () => {
    const sa = await db.Country.findOne({ where: { iso2: "SA" } });
    const extra = await db.City.create({ country_id: sa.id, city_name: "Test Village" });
    await loadGeoReference(db.sequelize);
    expect(await db.City.findByPk(extra.id)).not.toBeNull();
    await extra.destroy();
  });
});

describe("schema rules (§3)", () => {
  it("a city must have a country", async () => {
    await expect(db.City.create({ city_name: "Nowhere", country_id: null })).rejects.toThrow();
    await expect(
      db.sequelize.query("INSERT INTO cities (id, city_name, is_active, created_at, updated_at) VALUES (UUID(), 'Nowhere', 1, NOW(), NOW())")
    ).rejects.toThrow();
  });

  it("a GeoNames id is unique", async () => {
    const sa = await db.Country.findOne({ where: { iso2: "SA" } });
    await expect(db.City.create({ country_id: sa.id, city_name: "Riyadh copy", geoname_id: LEGACY_CITY_GEONAMES.Riyadh })).rejects.toThrow(
      db.Sequelize.UniqueConstraintError
    );
  });

  it("a country's iso2 is unique", async () => {
    await expect(db.Country.create({ iso2: "SA", name: "Again", calling_code: "+966" })).rejects.toThrow(db.Sequelize.UniqueConstraintError);
  });
});

describe("company country (D11)", () => {
  it("sign up gives the new company Saudi Arabia", async () => {
    const email = `owner-${Date.now()}@hrms.test`;
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ companyName: "Geo Test Co", name: "Geo Owner", email, password: "Test@12345", confirmPassword: "Test@12345" });
    expect(res.status).toBe(201);
    const user = await db.User.findOne({ where: { email } });
    const employer = await db.Employer.findOne({ where: { user_id: user.id } });
    expect(employer.country_id).toBe(seedId("country:SA"));
  });

  it("a company created without a country is in Saudi Arabia (column default)", async () => {
    const owner = await db.User.create({ name: "Owner", email: `o-${Date.now()}@hrms.test` });
    const employer = await db.Employer.create({ user_id: owner.id, company_name: "Default Co", employer_status: "ACTIVE" });
    await employer.reload();
    expect(employer.country_id).toBe(COMPANY_COUNTRY_ID);
  });
});

describe("matching existing texts (D13)", () => {
  let countries;
  let cities;
  beforeAll(async () => {
    countries = await db.Country.findAll({ attributes: ["id", "name", "name_ar"], raw: true });
    cities = await db.City.findAll({ attributes: ["id", "country_id", "city_name", "name_ar"], raw: true });
  });

  it.each([
    ["Saudi Arabia", "SA"],
    ["  saudi arabia ", "SA"],
    ["الهند", "IN"],
    ["PAKISTAN", "PK"],
  ])("matches the nationality %j to %s", (text, iso2) => {
    expect(matchCountryByName(text, countries)).toBe(seedId(`country:${iso2}`));
  });

  it.each(["Indian", "", null, "Atlantis"])("doesn't match %j", (text) => {
    expect(matchCountryByName(text, countries)).toBeNull();
  });

  it("matches a city only inside its country", () => {
    const sa = seedId("country:SA");
    const pk = seedId("country:PK");
    expect(matchCityByName("riyadh", sa, cities)).toBe(seedId("city:Riyadh"));
    expect(matchCityByName("الرياض", sa, cities)).toBe(seedId("city:Riyadh"));
    expect(matchCityByName("Riyadh", pk, cities)).toBeNull();
    expect(matchCityByName("Riyadh", null, cities)).toBeNull();
  });

  it("the data migration links nationalities and staffing cities, and reports what it couldn't match", async () => {
    const owner = await db.User.create({ name: "Owner", email: `b-${Date.now()}@hrms.test` });
    const employer = await db.Employer.create({ user_id: owner.id, company_name: "Backfill Co", employer_status: "ACTIVE" });
    const person = (n) => db.User.create({ name: `P ${n}`, email: `p${n}-${Date.now()}@hrms.test` });
    const make = async (n, nationality) =>
      db.Employee.create({
        user_id: (await person(n)).id,
        employer_id: employer.id,
        employee_code: `EMP-B${n}`,
        country_emp_id: `B${n}${Date.now()}`.slice(0, 20),
        full_name: `Person ${n}`,
        nationality,
      });
    const saudi = await make(1, "Saudi Arabia");
    const demonym = await make(2, "Indian");
    const staffing = await db.StaffingCompany.create({ employer_id: employer.id, name: "Gulf Supply", city: "Dammam" });
    const elsewhere = await db.StaffingCompany.create({ employer_id: employer.id, name: "Far Supply", city: "Lahore" });

    const report = await db.sequelize.transaction((transaction) => backfill(db.sequelize, transaction));

    await Promise.all([saudi, demonym, staffing, elsewhere].map((row) => row.reload()));
    expect(saudi.nationality_country_id).toBe(seedId("country:SA"));
    expect(demonym.nationality_country_id).toBeNull();
    expect(demonym.nationality).toBe("Indian");
    expect(demonym.residence_country_id).toBe(seedId("country:SA"));
    expect(staffing.country_id).toBe(seedId("country:SA"));
    expect(staffing.city_id).toBe(seedId("city:Dammam"));
    expect(elsewhere.city_id).toBeNull();
    expect(report).toEqual(
      expect.arrayContaining([
        { table: "employees", id: demonym.id, column: "nationality", value: "Indian" },
        { table: "hrms_staffing_companies", id: elsewhere.id, column: "city", value: "Lahore" },
      ])
    );
    expect(report.find((r) => r.id === saudi.id)).toBeUndefined();
  });
});
