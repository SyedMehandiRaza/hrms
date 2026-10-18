"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_exit_settings",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        default_notice_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
        default_cooling_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 180 },
        default_allow_leave_during_notice: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        default_encash_leave: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        block_loans_during_notice: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_exit_settings", ["employer_id"], { unique: true, name: "uq_hrms_exit_settings_employer_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_exit_settings");
  },
};
