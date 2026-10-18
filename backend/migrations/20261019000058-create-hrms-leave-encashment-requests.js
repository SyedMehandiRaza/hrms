"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_encashment_requests",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        leave_type_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" }, onDelete: "CASCADE" },
        leave_balance_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_leave_balances", key: "id" }, onDelete: "SET NULL" },
        financial_year_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_financial_years", key: "id" }, onDelete: "SET NULL" },
        days: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
        payout_year: { type: Sequelize.SMALLINT, allowNull: false },
        payout_month: { type: Sequelize.TINYINT, allowNull: false },
        daily_rate: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        amount_estimated: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        amount_final: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: "SAR" },
        status: { type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED", "CANCELLED", "PAID"), allowNull: false, defaultValue: "PENDING" },
        reason: { type: Sequelize.STRING(500), allowNull: true },
        reject_reason: { type: Sequelize.STRING(500), allowNull: true },
        approval_request_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_approval_requests", key: "id" }, onDelete: "SET NULL" },
        salary_transaction_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_salary_transactions", key: "id" }, onDelete: "SET NULL" },
        balance_transaction_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_leave_balance_transactions", key: "id" }, onDelete: "SET NULL" },
        requested_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        raised_on_behalf: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        approved_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        approved_at: { type: Sequelize.DATE, allowNull: true },
        cancelled_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_leave_encashment_requests", ["employer_id","status"], { name: "ix_hrms_leave_encashment_requests_employer_id_status" });
    await queryInterface.addIndex("hrms_leave_encashment_requests", ["employee_id","leave_type_id","status"], { name: "ix_hrms_leave_encashment_requests_employee_id_leave_type__9254b4" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_encashment_requests");
  },
};
