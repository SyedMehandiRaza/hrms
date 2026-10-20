"use strict";

// Countries and cities reference data (docs/plans/countries-cities-phones.md §3): ISO-3 code,
// Arabic names, flag, active flag; cities keep their GeoNames id (nullable, unique) and are
// searched by country and name.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("countries", "iso3", { type: Sequelize.CHAR(3), allowNull: true, after: "iso2" });
    await queryInterface.addColumn("countries", "name_ar", { type: Sequelize.STRING(150), allowNull: true, after: "name" });
    await queryInterface.addColumn("countries", "flag", { type: Sequelize.STRING(16), allowNull: true, after: "calling_code" });
    await queryInterface.addColumn("countries", "is_active", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: "flag",
    });

    await queryInterface.addColumn("cities", "name_ar", { type: Sequelize.STRING(150), allowNull: true, after: "city_name" });
    await queryInterface.addColumn("cities", "geoname_id", { type: Sequelize.INTEGER, allowNull: true, after: "name_ar" });
    await queryInterface.addIndex("cities", ["geoname_id"], { unique: true, name: "uq_cities_geoname_id" });
    await queryInterface.addIndex("cities", ["country_id", "city_name"], { name: "ix_cities_country_id_city_name" });
  },

  async down(queryInterface) {
    // The country FK may be using the composite index; give it its own one before dropping that.
    const [indexes] = await queryInterface.sequelize.query("SHOW INDEX FROM cities WHERE Column_name = 'country_id' AND Seq_in_index = 1");
    if (!indexes.some((i) => i.Key_name !== "ix_cities_country_id_city_name")) {
      await queryInterface.addIndex("cities", ["country_id"], { name: "ix_cities_country_id" });
    }
    await queryInterface.removeIndex("cities", "ix_cities_country_id_city_name");
    await queryInterface.removeIndex("cities", "uq_cities_geoname_id");
    await queryInterface.removeColumn("cities", "geoname_id");
    await queryInterface.removeColumn("cities", "name_ar");
    await queryInterface.removeColumn("countries", "is_active");
    await queryInterface.removeColumn("countries", "flag");
    await queryInterface.removeColumn("countries", "name_ar");
    await queryInterface.removeColumn("countries", "iso3");
  },
};
