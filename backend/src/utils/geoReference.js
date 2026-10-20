const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { seedId } = require("./seed");

// Country and city reference data (docs/plans/countries-cities-phones.md D1–D5). Global
// (no employer_id), read-only through the API, loaded from src/data/geo/*.json by a
// migration and by `npm run geo:load`. Uses raw SQL so migrations don't depend on models.

// Countries whose cities are loaded (D2).
const CITY_COUNTRIES = ["SA", "AE", "QA", "KW", "BH", "OM", "IN", "PK", "BD", "PH", "EG", "NP", "LK"];

// The 6 Saudi cities the first seed created by name (D5): their ids stay seedId("city:<key>").
const LEGACY_CITY_GEONAMES = {
  Riyadh: 108410,
  Jeddah: 105343,
  Dammam: 110336,
  Mecca: 104515,
  Medina: 109223,
  Khobar: 109323,
};

// Every company's country for now (D11). Its id is the seed id the first seed used.
const COMPANY_COUNTRY_ISO2 = "SA";
const COMPANY_COUNTRY_ID = seedId(`country:${COMPANY_COUNTRY_ISO2}`);

const DATA_DIR = path.resolve(__dirname, "../data/geo");
const readData = (file) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));

const countryId = (iso2) => seedId(`country:${iso2}`);
const cityId = (city) => seedId(city.legacyKey ? `city:${city.legacyKey}` : `city:geoname:${city.geonameId}`);

const CHUNK = 500;
const chunks = (rows) => Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) => rows.slice(i * CHUNK, (i + 1) * CHUNK));

// Upserts every country and city of the JSON files. Rows are matched by iso2 (countries) and by
// GeoNames id, then by the legacy seed id (cities); matched rows keep their id and get the new
// names. Nothing is ever deleted, so re-running adds only what's new. Returns what changed.
const loadGeoReference = async (sequelize, { transaction } = {}) => {
  const q = (sql, replacements) =>
    sequelize.query(sql, { replacements, transaction, type: sequelize.QueryTypes.SELECT });
  const exec = (sql, replacements) => sequelize.query(sql, { replacements, transaction });
  const now = new Date();
  const result = { countriesAdded: 0, countriesUpdated: 0, citiesAdded: 0, citiesUpdated: 0 };

  // One statement per chunk: rows whose id exists get the new values (is_active and created_at
  // are kept), the others are inserted.
  const upsert = async (table, columns, updated, rows) => {
    const placeholders = `(${columns.map(() => "?").join(", ")}, 1, ?, ?)`;
    for (const part of chunks(rows)) {
      await exec(
        `INSERT INTO ${table} (${columns.join(", ")}, is_active, created_at, updated_at) VALUES ${part.map(() => placeholders).join(", ")}
         ON DUPLICATE KEY UPDATE ${[...updated, "updated_at"].map((c) => `${c} = VALUES(${c})`).join(", ")}`,
        part.flatMap((r) => [...r, now, now])
      );
    }
  };

  const countries = readData("countries.json");
  const existingCountries = new Map(
    (await q("SELECT id, iso2 FROM countries WHERE iso2 IS NOT NULL")).map((r) => [r.iso2.toUpperCase(), r.id])
  );
  const countryRows = countries.map((c) => {
    const known = existingCountries.get(c.iso2);
    if (known) result.countriesUpdated += 1;
    else result.countriesAdded += 1;
    const id = known || countryId(c.iso2);
    existingCountries.set(c.iso2, id);
    return [id, c.iso2, c.name, c.nameAr, c.iso3, c.callingCode, c.flag];
  });
  await upsert(
    "countries",
    ["id", "iso2", "name", "name_ar", "iso3", "calling_code", "flag"],
    ["name", "name_ar", "iso3", "calling_code", "flag"],
    countryRows
  );

  const cities = readData("cities.json");
  const existingCities = await q("SELECT id, geoname_id FROM cities");
  const byGeoname = new Map(existingCities.filter((r) => r.geoname_id !== null).map((r) => [Number(r.geoname_id), r.id]));
  const byId = new Set(existingCities.map((r) => r.id));
  const cityRows = cities.map((c) => {
    const known = byGeoname.get(c.geonameId) || (byId.has(cityId(c)) ? cityId(c) : null);
    if (known) result.citiesUpdated += 1;
    else result.citiesAdded += 1;
    return [known || cityId(c), existingCountries.get(c.iso2), c.name, c.nameAr, c.geonameId];
  });
  await upsert(
    "cities",
    ["id", "country_id", "city_name", "name_ar", "geoname_id"],
    ["country_id", "city_name", "name_ar", "geoname_id"],
    cityRows
  );
  return result;
};

const norm = (text) => String(text ?? "").trim().toLowerCase();

// A country whose English or Arabic name equals the text (trimmed, any case), or null (D13).
const matchCountryByName = (text, countries) => {
  const key = norm(text);
  if (!key) return null;
  const hit = countries.find((c) => norm(c.name) === key || (c.name_ar && norm(c.name_ar) === key));
  return hit ? hit.id : null;
};

// A city of the given country whose English or Arabic name equals the text, or null.
const matchCityByName = (text, countryIdValue, cities) => {
  const key = norm(text);
  if (!key || !countryIdValue) return null;
  const hit = cities.find(
    (c) => c.country_id === countryIdValue && (norm(c.city_name) === key || (c.name_ar && norm(c.name_ar) === key))
  );
  return hit ? hit.id : null;
};

module.exports = {
  CITY_COUNTRIES,
  LEGACY_CITY_GEONAMES,
  COMPANY_COUNTRY_ISO2,
  COMPANY_COUNTRY_ID,
  loadGeoReference,
  matchCountryByName,
  matchCityByName,
  countryId,
  cityId,
  // Kept for scripts that need a fresh id outside the seed scheme.
  randomId: () => crypto.randomUUID(),
};
