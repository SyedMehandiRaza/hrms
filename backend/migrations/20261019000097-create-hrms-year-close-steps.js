"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_year_close_steps",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        financial_year_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" }, onDelete: "CASCADE" },
        step: { type: Sequelize.ENUM("READINESS", "LEAVE", "PAYROLL", "BILLING", "SETUP", "CLOSE"), allowNull: false },
        status: { type: Sequelize.ENUM("PENDING", "IN_PROGRESS", "DONE", "SKIPPED"), allowNull: false, defaultValue: "PENDING" },
        result: { type: Sequelize.JSON, allowNull: true },
        done_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        done_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_year_close_steps", ["financial_year_id","step"], { unique: true, name: "uq_hrms_year_close_steps_financial_year_id_step" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_year_close_steps");
  },
};
