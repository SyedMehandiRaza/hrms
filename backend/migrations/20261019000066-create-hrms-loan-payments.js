"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_loan_payments",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        loan_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_loans", key: "id" }, onDelete: "CASCADE" },
        installment_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_loan_installments", key: "id" }, onDelete: "SET NULL" },
        transaction_id: { type: Sequelize.STRING(64), allowNull: false },
        method: { type: Sequelize.ENUM("SALARY_DEDUCTION", "ONLINE", "ADJUSTMENT", "FNF_RECOVERY"), allowNull: false, defaultValue: "SALARY_DEDUCTION" },
        payslip_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_payroll", key: "id" }, onDelete: "SET NULL" },
        salary_transaction_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_salary_transactions", key: "id" }, onDelete: "SET NULL" },
        period_month: { type: Sequelize.TINYINT, allowNull: true },
        period_year: { type: Sequelize.SMALLINT, allowNull: true },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        status: { type: Sequelize.ENUM("INITIATED", "SUCCESS", "PARTIAL", "FAILED", "REVERSED"), allowNull: false, defaultValue: "SUCCESS" },
        gateway_reference: { type: Sequelize.STRING(100), allowNull: true },
        failure_reason: { type: Sequelize.STRING(255), allowNull: true },
        paid_at: { type: Sequelize.DATE, allowNull: true },
        reversal_of_payment_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_loan_payments", key: "id" }, onDelete: "SET NULL" },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_loan_payments", ["employer_id","transaction_id"], { unique: true, name: "uq_hrms_loan_payments_employer_id_transaction_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_loan_payments");
  },
};
