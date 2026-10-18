"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "countries",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        name: { type: Sequelize.STRING(150), allowNull: false },
        calling_code: { type: Sequelize.STRING(10), allowNull: true },
        iso2: { type: Sequelize.CHAR(2), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("countries", ["iso2"], { unique: true, name: "uq_countries_iso2" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("countries");
  },
};
