"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_payroll",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        run_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_payroll_runs", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        gross_salary: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        total_deductions: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        net_salary: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        total_working_days: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        total_present_days: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        absent_days: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        leave_days: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        unpaid_leave_count: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        total_worked_hours: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
        worked_hours: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
        overtime_hours: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
        pending_hours: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
        overtime_status: { type: Sequelize.ENUM("NONE", "PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "NONE" },
        pdf_url: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.ENUM("PENDING", "HOLD", "CREDITED"), allowNull: false, defaultValue: "PENDING" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_payroll", ["run_id","employee_id"], { unique: true, name: "uq_hrms_payroll_run_id_employee_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_payroll");
  },
};
