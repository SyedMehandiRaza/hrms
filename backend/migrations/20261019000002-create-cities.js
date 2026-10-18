"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "cities",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        country_id: { type: Sequelize.UUID, allowNull: true, references: { model: "countries", key: "id" }, onDelete: "SET NULL" },
        city_name: { type: Sequelize.STRING(150), allowNull: false },
        city_code: { type: Sequelize.STRING(50), allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("cities", ["city_name"], { name: "ix_cities_city_name" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("cities");
  },
};
