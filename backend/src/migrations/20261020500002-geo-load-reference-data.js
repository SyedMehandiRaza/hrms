"use strict";

const { loadGeoReference, LEGACY_CITY_GEONAMES, countryId } = require("../utils/geoReference");
const { seedId } = require("../utils/seed");

// Drops whatever FK cities.country_id has, sets the column's nullability, adds fk_cities_country_id.
const setCountryLink = async (queryInterface, { nullable, onDelete }) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cities' AND COLUMN_NAME = 'country_id' AND REFERENCED_TABLE_NAME = 'countries'`
  );
  for (const { name } of rows) await queryInterface.sequelize.query(`ALTER TABLE cities DROP FOREIGN KEY \`${name}\``);
  await queryInterface.sequelize.query(`ALTER TABLE cities MODIFY country_id CHAR(36) BINARY ${nullable ? "NULL" : "NOT NULL"}`);
  await queryInterface.sequelize.query(
    `ALTER TABLE cities ADD CONSTRAINT fk_cities_country_id FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE ${onDelete} ON UPDATE CASCADE`
  );
};

// Loads every country and the cities of the GCC + labour-source countries (plan D1–D5) from
// src/data/geo/*.json, keeping the ids of rows that already exist, then makes the links required.
// Reference data, not dev data: it's in a migration so every database (tests included) has it.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const result = await loadGeoReference(queryInterface.sequelize, { transaction });
      console.log(`[geo] countries +${result.countriesAdded} ~${result.countriesUpdated}, cities +${result.citiesAdded} ~${result.citiesUpdated}`);
    });

    // A city row without a country (only possible before this migration) can't stay.
    await queryInterface.sequelize.query("DELETE FROM cities WHERE country_id IS NULL");
    await queryInterface.changeColumn("countries", "iso2", { type: Sequelize.CHAR(2), allowNull: false });
    await queryInterface.changeColumn("countries", "calling_code", { type: Sequelize.STRING(10), allowNull: false });
    // The old FK is ON DELETE SET NULL, which MySQL refuses on a NOT NULL column: replace it.
    await setCountryLink(queryInterface, { nullable: false, onDelete: "RESTRICT" });
  },

  // Schema back as it was; rows added by up() go, except the 6 countries and 6 cities the
  // first seed created (seeded databases keep working).
  async down(queryInterface, Sequelize) {
    await setCountryLink(queryInterface, { nullable: true, onDelete: "SET NULL" });
    await queryInterface.changeColumn("countries", "calling_code", { type: Sequelize.STRING(10), allowNull: true });
    await queryInterface.changeColumn("countries", "iso2", { type: Sequelize.CHAR(2), allowNull: true });

    const keepCities = Object.keys(LEGACY_CITY_GEONAMES).map((key) => seedId(`city:${key}`));
    const keepCountries = ["SA", "IN", "PK", "EG", "PH", "BD"].map(countryId);
    await queryInterface.bulkDelete("cities", { id: { [Sequelize.Op.notIn]: keepCities } });
    await queryInterface.bulkDelete("countries", { id: { [Sequelize.Op.notIn]: keepCountries } });
  },
};
