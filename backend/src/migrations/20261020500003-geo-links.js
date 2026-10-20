"use strict";

const { COMPANY_COUNTRY_ID, matchCountryByName, matchCityByName } = require("../utils/geoReference");

// Country / city / phone-country links (docs/plans/countries-cities-phones.md D11–D13, D15, §3).
// Every company's country is Saudi Arabia for now; employees live in their company's country
// until told otherwise. Existing nationality and staffing-company city texts are matched to
// rows by English or Arabic name; what doesn't match is reported and left NULL (text kept).
// Phone numbers themselves are converted later (geo 02); only the phone-country columns are added.

const fk = (Sequelize, table, onDelete) => ({ references: { model: table, key: "id" }, onDelete, onUpdate: "CASCADE" });

const COLUMNS = (Sequelize) => [
  ["employers", "country_id", { type: Sequelize.UUID, allowNull: false, defaultValue: COMPANY_COUNTRY_ID, ...fk(Sequelize, "countries", "RESTRICT") }],
  ["employers", "phone_country", { type: Sequelize.CHAR(2), allowNull: true }],
  ["users", "phone_country", { type: Sequelize.CHAR(2), allowNull: true }],
  ["employees", "nationality_country_id", { type: Sequelize.UUID, allowNull: true, ...fk(Sequelize, "countries", "SET NULL") }],
  ["employees", "residence_country_id", { type: Sequelize.UUID, allowNull: false, defaultValue: COMPANY_COUNTRY_ID, ...fk(Sequelize, "countries", "RESTRICT") }],
  ["employees", "residence_city_id", { type: Sequelize.UUID, allowNull: true, ...fk(Sequelize, "cities", "SET NULL") }],
  ["offices", "country_id", { type: Sequelize.UUID, allowNull: true, ...fk(Sequelize, "countries", "RESTRICT") }],
  ["offices", "city_id", { type: Sequelize.UUID, allowNull: true, ...fk(Sequelize, "cities", "SET NULL") }],
  ["offices", "phone_country", { type: Sequelize.CHAR(2), allowNull: true }],
  ["projects", "country_id", { type: Sequelize.UUID, allowNull: true, ...fk(Sequelize, "countries", "RESTRICT") }],
  ["hrms_staffing_companies", "country_id", { type: Sequelize.UUID, allowNull: true, ...fk(Sequelize, "countries", "RESTRICT") }],
  ["hrms_staffing_companies", "city_id", { type: Sequelize.UUID, allowNull: true, ...fk(Sequelize, "cities", "SET NULL") }],
  ["hrms_staffing_companies", "phone_country", { type: Sequelize.CHAR(2), allowNull: true }],
  ["hrms_staffing_companies", "contact_person_phone_country", { type: Sequelize.CHAR(2), allowNull: true }],
];

// Matches existing texts to countries/cities. Returns the unmatched rows for the report.
const backfill = async (sequelize, transaction) => {
  const select = (sql) => sequelize.query(sql, { transaction, type: sequelize.QueryTypes.SELECT });
  const exec = (sql, replacements) => sequelize.query(sql, { replacements, transaction });
  const countries = await select("SELECT id, name, name_ar FROM countries");
  const cities = await select("SELECT id, country_id, city_name, name_ar FROM cities");
  const report = [];

  for (const e of await select("SELECT id, nationality FROM employees WHERE nationality IS NOT NULL AND TRIM(nationality) <> ''")) {
    const id = matchCountryByName(e.nationality, countries);
    if (id) await exec("UPDATE employees SET nationality_country_id = ? WHERE id = ?", [id, e.id]);
    else report.push({ table: "employees", id: e.id, column: "nationality", value: e.nationality });
  }

  await exec("UPDATE employees e JOIN employers c ON c.id = e.employer_id SET e.residence_country_id = c.country_id");
  await exec("UPDATE offices o JOIN employers c ON c.id = o.employer_id SET o.country_id = c.country_id WHERE o.country_id IS NULL");
  await exec(
    `UPDATE projects p JOIN employers c ON c.id = p.employer_id LEFT JOIN cities ci ON ci.id = p.city_id
     SET p.country_id = COALESCE(ci.country_id, c.country_id) WHERE p.country_id IS NULL`
  );
  await exec(
    "UPDATE hrms_staffing_companies s JOIN employers c ON c.id = s.employer_id SET s.country_id = c.country_id WHERE s.country_id IS NULL"
  );

  for (const s of await select("SELECT id, country_id, city FROM hrms_staffing_companies WHERE city IS NOT NULL AND TRIM(city) <> ''")) {
    const id = matchCityByName(s.city, s.country_id, cities);
    if (id) await exec("UPDATE hrms_staffing_companies SET city_id = ? WHERE id = ?", [id, s.id]);
    else report.push({ table: "hrms_staffing_companies", id: s.id, column: "city", value: s.city });
  }
  return report;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [table, column, spec] of COLUMNS(Sequelize)) await queryInterface.addColumn(table, column, spec);

    const report = await queryInterface.sequelize.transaction((transaction) => backfill(queryInterface.sequelize, transaction));
    console.log(`[geo] links backfilled; ${report.length} value(s) not matched (left NULL, text kept)`);
    report.forEach((r) => console.log(`[geo] not matched: ${r.table}.${r.column} id=${r.id} value=${JSON.stringify(r.value)}`));
  },

  async down(queryInterface, Sequelize) {
    for (const [table, column] of [...COLUMNS(Sequelize)].reverse()) await queryInterface.removeColumn(table, column);
  },

  backfill,
};
