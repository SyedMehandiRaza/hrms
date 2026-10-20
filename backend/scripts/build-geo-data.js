// Dev-only: builds the committed reference data (docs/plans/countries-cities-phones.md D1–D3).
//
//   node scripts/build-geo-data.js <cities15000.txt> <alternatenames dir>
//
// <cities15000.txt>: GeoNames https://download.geonames.org/export/dump/cities15000.zip (unzipped).
// <alternatenames dir>: one folder per country, each holding GeoNames
//   https://download.geonames.org/export/dump/alternatenames/<CC>.zip unzipped (<CC>.txt).
// Writes src/data/geo/countries.json and src/data/geo/cities.json. GeoNames data is CC BY 4.0
// (attribution: docs/reference-data.md).
const fs = require("fs");
const path = require("path");
const countries = require("i18n-iso-countries");
const { getCountryCallingCode, getCountries } = require("libphonenumber-js");
const { CITY_COUNTRIES, LEGACY_CITY_GEONAMES } = require("../src/utils/geoReference");

countries.registerLocale(require("i18n-iso-countries/langs/en.json"));
countries.registerLocale(require("i18n-iso-countries/langs/ar.json"));

const [citiesFile, altDir] = process.argv.slice(2);
if (!citiesFile || !altDir) {
  console.error("usage: node scripts/build-geo-data.js <cities15000.txt> <alternatenames dir>");
  process.exit(1);
}

const outDir = path.resolve(__dirname, "../src/data/geo");
fs.mkdirSync(outDir, { recursive: true });

// Regional-indicator letters: "SA" → 🇸🇦.
const flag = (iso2) => String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

// Countries: every ISO code that also has a phone numbering plan (a phone country needs one).
const phoneCountries = new Set(getCountries());
const countryRows = Object.keys(countries.getAlpha2Codes())
  .filter((iso2) => phoneCountries.has(iso2))
  .map((iso2) => ({
    iso2,
    iso3: countries.alpha2ToAlpha3(iso2),
    name: countries.getName(iso2, "en", { select: "official" }),
    nameAr: countries.getName(iso2, "ar", { select: "official" }) || null,
    callingCode: `+${getCountryCallingCode(iso2)}`,
    flag: flag(iso2),
  }))
  .sort((a, b) => a.iso2.localeCompare(b.iso2));

// Cities: GeoNames cities15000 for the listed countries. Columns (tab-separated):
// 0 geonameid, 1 name, 2 asciiname, 3 alternatenames, …, 8 country code, …, 14 population.
const wanted = new Set(CITY_COUNTRIES);
const cityRows = fs
  .readFileSync(citiesFile, "utf8")
  .split("\n")
  .map((line) => line.split("\t"))
  .filter((cols) => cols.length > 14 && wanted.has(cols[8]))
  .map((cols) => ({ geonameId: Number(cols[0]), iso2: cols[8], name: cols[1], population: Number(cols[14]) }));

// Arabic names from the per-country alternate names: language "ar", not colloquial or historic;
// the preferred name wins, then the first one listed. Columns: 0 id, 1 geonameid, 2 language,
// 3 name, 4 isPreferredName, 5 isShortName, 6 isColloquial, 7 isHistoric.
const arabic = new Map();
for (const iso2 of CITY_COUNTRIES) {
  const file = path.join(altDir, `alt-${iso2}`, `${iso2}.txt`);
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const cols = line.split("\t");
    if (cols[2] !== "ar" || cols[6] === "1" || cols[7] === "1") continue;
    const id = Number(cols[1]);
    const current = arabic.get(id);
    if (!current || (cols[4] === "1" && !current.preferred)) arabic.set(id, { name: cols[3].trim(), preferred: cols[4] === "1" });
  }
}

const legacyByGeoname = new Map(Object.entries(LEGACY_CITY_GEONAMES).map(([key, id]) => [id, key]));
const cityOut = cityRows
  .map((c) => ({
    geonameId: c.geonameId,
    iso2: c.iso2,
    name: c.name,
    nameAr: arabic.get(c.geonameId)?.name || null,
    ...(legacyByGeoname.has(c.geonameId) ? { legacyKey: legacyByGeoname.get(c.geonameId) } : {}),
  }))
  .sort((a, b) => a.iso2.localeCompare(b.iso2) || a.name.localeCompare(b.name) || a.geonameId - b.geonameId);

const missingLegacy = Object.values(LEGACY_CITY_GEONAMES).filter((id) => !cityOut.some((c) => c.geonameId === id));
if (missingLegacy.length) throw new Error(`legacy cities missing from the data: ${missingLegacy.join(", ")}`);

fs.writeFileSync(path.join(outDir, "countries.json"), `${JSON.stringify(countryRows, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, "cities.json"), `${JSON.stringify(cityOut)}\n`);
console.log(`countries: ${countryRows.length}, cities: ${cityOut.length}, cities with Arabic: ${cityOut.filter((c) => c.nameAr).length}`);
