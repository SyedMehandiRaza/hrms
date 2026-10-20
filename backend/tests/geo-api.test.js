const express = require("express");
const request = require("supertest");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const app = require("../src/app");
const db = require("../src/models");
const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");
const { seedId } = require("../src/utils/seed");
const language = require("../src/middlewares/language");
const errorHandler = require("../src/middlewares/errorHandler");
const { createGeoRouter } = require("../src/routes/geo.routes");
const { assertCityInCountry, assertCountry } = require("../src/services/geo.service");
const countriesJson = require("../src/data/geo/countries.json");

// Countries and cities API (ticket geo#03; countries-cities-phones D7–D10, §4).

const SA = seedId("country:SA");
const FR = seedId("country:FR");
const PK = seedId("country:PK");
const errorBody = (code, lang = "en") => ({ success: false, code, message: MESSAGES[code][lang] });

afterAll(async () => {
  await db.sequelize.close();
});

describe("GET /api/countries", () => {
  it("answers without a login: every active country with id, iso2, name, calling code, flag and hasCities", async () => {
    const res = await request(app).get("/api/countries");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { items } = res.body.data;
    const reference = items.filter((c) => countriesJson.some((j) => j.iso2 === c.iso2));
    expect(reference).toHaveLength(countriesJson.length);
    expect(items.find((c) => c.iso2 === "SA")).toEqual({
      id: SA,
      iso2: "SA",
      name: "Saudi Arabia",
      callingCode: "+966",
      flag: "🇸🇦",
      hasCities: true,
    });
    expect(items.find((c) => c.iso2 === "FR").hasCities).toBe(false);
    expect(Object.keys(items[0]).sort()).toEqual(["callingCode", "flag", "hasCities", "id", "iso2", "name"]);
  });

  it("is sorted by name", async () => {
    const { items } = (await request(app).get("/api/countries")).body.data;
    const names = items.filter((c) => /^[A-Z]{2}$/.test(c.iso2)).map((c) => c.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("en", { sensitivity: "base" }).compare));
  });

  it("returns Arabic names, sorted in Arabic, for Accept-Language: ar", async () => {
    const res = await request(app).get("/api/countries").set("Accept-Language", "ar");
    const items = res.body.data.items.filter((c) => /^[A-Z]{2}$/.test(c.iso2));
    expect(items.find((c) => c.iso2 === "SA").name).toBe("السعودية");
    expect(items.find((c) => c.iso2 === "IN").name).toBe("الهند");
    const names = items.map((c) => c.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("ar", { sensitivity: "base" }).compare));
  });

  it("leaves out inactive countries", async () => {
    await db.Country.update({ is_active: false }, { where: { iso2: "FR" } });
    try {
      const { items } = (await request(app).get("/api/countries")).body.data;
      expect(items.find((c) => c.iso2 === "FR")).toBeUndefined();
    } finally {
      await db.Country.update({ is_active: true }, { where: { iso2: "FR" } });
    }
  });

  it("is cacheable", async () => {
    const res = await request(app).get("/api/countries");
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
  });
});

describe("GET /api/countries/:id/cities", () => {
  it("searches a country's cities: 'jed' → Jeddah first, 20 per page with paging info", async () => {
    const res = await request(app).get(`/api/countries/${SA}/cities?search=jed`);
    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).toEqual({ id: seedId("city:Jeddah"), name: "Jeddah" });
    expect(res.body.data).toMatchObject({ page: 1, limit: 20 });
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("lists every city when there's no search, 20 at a time, alphabetically", async () => {
    const first = (await request(app).get(`/api/countries/${SA}/cities`)).body.data;
    expect(first.items).toHaveLength(20);
    expect(first.total).toBeGreaterThan(20);
    const names = first.items.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
    const second = (await request(app).get(`/api/countries/${SA}/cities?page=2&limit=20`)).body.data;
    expect(second.page).toBe(2);
    expect(second.items.map((c) => c.id)).not.toContain(first.items[0].id);
  });

  it("puts names that start with the search before names that only contain it", async () => {
    const { items } = (await request(app).get(`/api/countries/${SA}/cities?search=ri&limit=100`)).body.data;
    const starts = items.findIndex((c) => !c.name.toLowerCase().startsWith("ri"));
    if (starts !== -1) items.slice(starts).forEach((c) => expect(c.name.toLowerCase().startsWith("ri")).toBe(false));
    expect(items[0].name.toLowerCase().startsWith("ri")).toBe(true);
  });

  it("searches Arabic names and answers in Arabic", async () => {
    const res = await request(app).get(`/api/countries/${SA}/cities?search=${encodeURIComponent("جدة")}`).set("Accept-Language", "ar");
    expect(res.body.data.items[0]).toEqual({ id: seedId("city:Jeddah"), name: "جدة" });
  });

  it("shows the English name in Arabic when GeoNames has no Arabic name", async () => {
    const city = await db.City.findOne({ where: { country_id: PK, name_ar: null } });
    const res = await request(app)
      .get(`/api/countries/${PK}/cities?search=${encodeURIComponent(city.city_name)}&limit=100`)
      .set("Accept-Language", "ar");
    expect(res.body.data.items).toContainEqual({ id: city.id, name: city.city_name });
  });

  it("a country with no cities → an empty list", async () => {
    const res = await request(app).get(`/api/countries/${FR}/cities`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });

  it("leaves out inactive cities", async () => {
    await db.City.update({ is_active: false }, { where: { id: seedId("city:Khobar") } });
    try {
      const { items } = (await request(app).get(`/api/countries/${SA}/cities?search=khobar`)).body.data;
      expect(items.find((c) => c.id === seedId("city:Khobar"))).toBeUndefined();
    } finally {
      await db.City.update({ is_active: true }, { where: { id: seedId("city:Khobar") } });
    }
  });

  it.each(["6b0c1c4e-0000-4000-a000-000000000000", "not-a-uuid"])("an unknown country %s → 404 NOT_FOUND", async (id) => {
    const res = await request(app).get(`/api/countries/${id}/cities`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("NOT_FOUND"));
  });

  it("an inactive country → 404 NOT_FOUND (in Arabic when asked)", async () => {
    await db.Country.update({ is_active: false }, { where: { id: FR } });
    try {
      const res = await request(app).get(`/api/countries/${FR}/cities`).set("Accept-Language", "ar");
      expect(res.status).toBe(404);
      expect(res.body).toEqual(errorBody("NOT_FOUND", "ar"));
    } finally {
      await db.Country.update({ is_active: true }, { where: { id: FR } });
    }
  });

  it.each([
    ["page=0", "page"],
    ["limit=0", "limit"],
    ["limit=101", "limit"],
    ["page=abc", "page"],
    [`search=${"x".repeat(151)}`, "search"],
  ])("a bad query (%s) → 400 VALIDATION_FAILED on %s", async (query, field) => {
    const res = await request(app).get(`/api/countries/${SA}/cities?${query}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ...errorBody("VALIDATION_FAILED"), errors: { [field]: MESSAGES.VALIDATION_FAILED.en } });
  });
});

describe("shared checks for other modules", () => {
  it("a city of the chosen country passes; an empty city is allowed", async () => {
    await expect(assertCityInCountry(seedId("city:Riyadh"), SA)).resolves.toBeUndefined();
    await expect(assertCityInCountry(null, SA)).resolves.toBeUndefined();
    await expect(assertCityInCountry("", SA)).resolves.toBeUndefined();
  });

  it.each([
    ["a city of another country", () => seedId("city:Riyadh"), PK],
    ["an unknown city", () => "6b0c1c4e-0000-4000-a000-000000000000", SA],
    ["a malformed id", () => "riyadh", SA],
  ])("%s → cityId 'Select a city in the selected country.'", async (_label, city, country) => {
    await expect(assertCityInCountry(city(), country)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      errors: { cityId: "cityNotInCountry" },
    });
    expect(FIELD_MESSAGES.cityNotInCountry.en).toBe("Select a city in the selected country.");
  });

  it("reports under the field name it's given", async () => {
    await expect(assertCityInCountry(seedId("city:Riyadh"), PK, "residenceCityId")).rejects.toMatchObject({
      errors: { residenceCityId: "cityNotInCountry" },
    });
  });

  it("an active country passes; anything else → countryId 'Select a country.'", async () => {
    await expect(assertCountry(SA)).resolves.toMatchObject({ id: SA, iso2: "SA" });
    await expect(assertCountry("nope")).rejects.toMatchObject({ errors: { countryId: "countryRequired" } });
    await expect(assertCountry(null, "residenceCountryId")).rejects.toMatchObject({ errors: { residenceCountryId: "countryRequired" } });
    expect(FIELD_MESSAGES.countryRequired.en).toBe("Select a country.");
  });
});

describe("rate limit (60/min per IP and route)", () => {
  const limitedApp = (limits) => {
    const limited = express();
    limited.use(language);
    limited.use("/api/countries", createGeoRouter(limits));
    limited.use(errorHandler);
    return limited;
  };

  it("answers the 61st request in a minute with 429 RATE_LIMITED; the cities route has its own budget", async () => {
    const limited = limitedApp({ windowMs: 60 * 1000, lookupMax: 60 });
    for (let i = 0; i < 60; i += 1) {
      expect((await request(limited).get("/api/countries")).status).toBe(200);
    }
    const over = await request(limited).get("/api/countries");
    expect(over.status).toBe(429);
    expect(over.body).toEqual(errorBody("RATE_LIMITED"));
    expect((await request(limited).get(`/api/countries/${SA}/cities`)).status).toBe(200);
  });
});
