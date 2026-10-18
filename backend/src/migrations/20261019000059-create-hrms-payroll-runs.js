"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_payroll_runs",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        reference_no: { type: Sequelize.STRING(30), allowNull: false },
        period_month: { type: Sequelize.TINYINT, allowNull: false },
        period_year: { type: Sequelize.SMALLINT, allowNull: false },
        period_start: { type: Sequelize.DATEONLY, allowNull: false },
        period_end: { type: Sequelize.DATEONLY, allowNull: false },
        status: { type: Sequelize.ENUM("DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PAID", "CREDITED"), allowNull: false, defaultValue: "DRAFT" },
        reject_reason: { type: Sequelize.TEXT, allowNull: true },
        approval_request_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_approval_requests", key: "id" }, onDelete: "SET NULL" },
        total_net: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        generated_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        generated_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_payroll_runs", ["employer_id","reference_no"], { unique: true, name: "uq_hrms_payroll_runs_employer_id_reference_no" });
    await queryInterface.addIndex("hrms_payroll_runs", ["employer_id","period_year","period_month"], { name: "ix_hrms_payroll_runs_employer_id_period_year_period_month" });
    await queryInterface.addIndex("hrms_payroll_runs", ["status"], { name: "ix_hrms_payroll_runs_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_payroll_runs");
  },
};
