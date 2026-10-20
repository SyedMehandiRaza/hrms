const { Op } = require("sequelize");
const { sequelize, Country, City } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { UUID, likePattern } = require("./department.service");

// Country and city lookups (docs/plans/countries-cities-phones.md D7–D10, §4). Reference data is
// global (no employer_id). Names come in the request language, falling back to English.

const localName = (row, lang, englishKey = "name") => (lang === "ar" && row.name_ar) || row[englishKey];

// Active cities of the row's country (hasCities).
const HAS_CITIES = sequelize.literal(
  "EXISTS (SELECT 1 FROM `cities` AS `c` WHERE `c`.`country_id` = `Country`.`id` AND `c`.`is_active` = 1)"
);

// GET /countries: every active country, sorted by its name in the request language.
const listCountries = async (lang) => {
  const rows = await Country.findAll({
    where: { is_active: true },
    attributes: ["id", "iso2", "name", "name_ar", "calling_code", "flag", [HAS_CITIES, "has_cities"]],
  });
  const collator = new Intl.Collator(lang === "ar" ? "ar" : "en", { sensitivity: "base" });
  return rows
    .map((c) => ({
      id: c.id,
      iso2: c.iso2,
      name: localName(c, lang),
      callingCode: c.calling_code,
      flag: c.flag,
      hasCities: Boolean(Number(c.get("has_cities"))),
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
};

// The active country with this id, or 404 (also for a malformed id).
const findActiveCountry = async (id, options = {}) => {
  const country = UUID.test(String(id)) ? await Country.findOne({ where: { id, is_active: true }, ...options }) : null;
  if (!country) throw new ErrorHandler("NOT_FOUND");
  return country;
};

// GET /countries/:id/cities. Matches the English or Arabic name; names starting with the search
// come first, then alphabetical.
const listCities = async (lang, countryId, { search, page, limit }) => {
  const country = await findActiveCountry(countryId, { attributes: ["id"] });
  const where = { country_id: country.id, is_active: true };
  const order = [];
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [{ city_name: { [Op.like]: pattern } }, { name_ar: { [Op.like]: pattern } }];
    const prefix = sequelize.escape(`${search.replace(/[\\%_]/g, "\\$&")}%`);
    order.push([sequelize.literal(`CASE WHEN city_name LIKE ${prefix} OR name_ar LIKE ${prefix} THEN 0 ELSE 1 END`), "ASC"]);
  }
  order.push([lang === "ar" ? sequelize.fn("COALESCE", sequelize.col("name_ar"), sequelize.col("city_name")) : "city_name", "ASC"]);
  order.push(["id", "ASC"]);

  const { count, rows } = await City.findAndCountAll({
    where,
    attributes: ["id", "city_name", "name_ar"],
    order,
    limit,
    offset: (page - 1) * limit,
  });
  return { items: rows.map((c) => ({ id: c.id, name: localName(c, lang, "city_name") })), total: count, page, limit };
};

// For other modules: the city must be an active city of the chosen country, else a field error
// "Select a city in the selected country." under `field`. An empty city is allowed (D7).
const assertCityInCountry = async (cityId, countryId, field = "cityId", { transaction } = {}) => {
  if (cityId === null || cityId === undefined || cityId === "") return;
  const city = UUID.test(String(cityId))
    ? await City.findOne({ where: { id: cityId, country_id: countryId, is_active: true }, attributes: ["id"], transaction })
    : null;
  if (!city) throw new ErrorHandler("VALIDATION_FAILED", { errors: { [field]: "cityNotInCountry" } });
};

// For other modules: an active country, else a field error "Select a country." under `field`.
const assertCountry = async (countryId, field = "countryId", { transaction } = {}) => {
  const country = UUID.test(String(countryId))
    ? await Country.findOne({ where: { id: countryId, is_active: true }, attributes: ["id", "iso2"], transaction })
    : null;
  if (!country) throw new ErrorHandler("VALIDATION_FAILED", { errors: { [field]: "countryRequired" } });
  return country;
};

module.exports = { listCountries, listCities, findActiveCountry, assertCityInCountry, assertCountry, localName };
