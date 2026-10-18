"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "modules",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        module_key: { type: Sequelize.STRING(100), allowNull: false },
        name: { type: Sequelize.STRING(150), allowNull: false },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("modules", ["module_key"], { unique: true, name: "uq_modules_module_key" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("modules");
  },
};
