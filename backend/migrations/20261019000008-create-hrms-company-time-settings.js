"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_company_time_settings",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        timezone: { type: Sequelize.STRING(64), allowNull: false, defaultValue: "Asia/Riyadh" },
        fy_start_month: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        review_days_before: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
        auto_open_next_year: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        reopen_window_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 7 },
        lock_mode: { type: Sequelize.ENUM("YEARLY", "MONTHLY"), allowNull: false, defaultValue: "YEARLY" },
        pending_on_close: { type: Sequelize.ENUM("BLOCK", "CANCEL", "CARRY"), allowNull: false, defaultValue: "BLOCK" },
        offline_backdate_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_company_time_settings", ["employer_id"], { unique: true, name: "uq_hrms_company_time_settings_employer_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_company_time_settings");
  },
};
