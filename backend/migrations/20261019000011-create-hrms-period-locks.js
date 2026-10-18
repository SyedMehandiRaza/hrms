"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_period_locks",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        financial_year_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" }, onDelete: "CASCADE" },
        period_year: { type: Sequelize.SMALLINT, allowNull: false },
        period_month: { type: Sequelize.TINYINT, allowNull: false },
        module: { type: Sequelize.ENUM("ALL", "ATTENDANCE", "LEAVE", "PAYROLL", "BILLING"), allowNull: false, defaultValue: "ALL" },
        locked_at: { type: Sequelize.DATE, allowNull: false },
        locked_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        reason: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_period_locks", ["employer_id","period_year","period_month","module"], { unique: true, name: "uq_hrms_period_locks_employer_id_period_year_period_month_module" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_period_locks");
  },
};
