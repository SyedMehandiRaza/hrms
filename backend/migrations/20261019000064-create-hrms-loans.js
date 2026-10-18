"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_loans",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        loan_number: { type: Sequelize.STRING(30), allowNull: true },
        requested_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        requested_installments: { type: Sequelize.INTEGER, allowNull: false },
        purpose: { type: Sequelize.STRING(500), allowNull: true },
        approved_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        approved_installments: { type: Sequelize.INTEGER, allowNull: true },
        emi_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        interest_rate: { type: Sequelize.DECIMAL(6, 3), allowNull: true },
        on_insufficient_salary: { type: Sequelize.ENUM("SKIP", "PARTIAL", "FORCE"), allowNull: false, defaultValue: "SKIP" },
        status: { type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED", "DISBURSED", "ACTIVE", "COMPLETED", "CLOSED", "FORECLOSED", "CANCELLED", "MODIFICATION_REQUESTED"), allowNull: false, defaultValue: "PENDING" },
        approver_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        reject_reason: { type: Sequelize.STRING(500), allowNull: true },
        outstanding_principal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        first_deduction_month: { type: Sequelize.DATEONLY, allowNull: true },
        recovery_status: { type: Sequelize.ENUM("NONE", "IN_FNF", "RECOVERED", "WRITTEN_OFF"), allowNull: false, defaultValue: "NONE" },
        applied_at: { type: Sequelize.DATE, allowNull: true },
        approved_at: { type: Sequelize.DATE, allowNull: true },
        disbursed_at: { type: Sequelize.DATE, allowNull: true },
        closed_at: { type: Sequelize.DATE, allowNull: true },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        meta: { type: Sequelize.JSON, allowNull: true },
        version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_loans", ["employer_id","loan_number"], { unique: true, name: "uq_hrms_loans_employer_id_loan_number" });
    await queryInterface.addIndex("hrms_loans", ["employer_id","status"], { name: "ix_hrms_loans_employer_id_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_loans");
  },
};
