"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_year_overrides",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        financial_year_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" }, onDelete: "CASCADE" },
        leave_balance_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_balances", key: "id" }, onDelete: "CASCADE" },
        carry_days: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        encash_days: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        reason: { type: Sequelize.STRING(500), allowNull: false },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_leave_year_overrides", ["financial_year_id","leave_balance_id"], { unique: true, name: "uq_hrms_leave_year_overrides_financial_year_id_leave_balance_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_year_overrides");
  },
};
