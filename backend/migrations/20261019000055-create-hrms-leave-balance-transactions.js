"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_balance_transactions",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        leave_balance_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_balances", key: "id" }, onDelete: "CASCADE" },
        leave_type_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" }, onDelete: "CASCADE" },
        transaction_type: { type: Sequelize.ENUM("CREDIT", "DEBIT", "ADJUSTMENT", "REVERSAL", "CARRY_FORWARD", "ACCRUAL", "ENCASHMENT", "EXPIRY"), allowNull: false },
        leave_source: { type: Sequelize.ENUM("MANUAL", "SYSTEM", "LEAVE_REQUEST", "ACCRUAL", "ENCASHMENT", "CARRY_FORWARD", "EXPIRY"), allowNull: false, defaultValue: "SYSTEM" },
        transaction_date: { type: Sequelize.DATEONLY, allowNull: false },
        days: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
        balance_before: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
        balance_after: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
        reference_type: { type: Sequelize.STRING(100), allowNull: true },
        reference_id: { type: Sequelize.CHAR(36), allowNull: true },
        reference_code: { type: Sequelize.STRING(100), allowNull: true },
        remarks: { type: Sequelize.TEXT, allowNull: true },
        leave_year: { type: Sequelize.SMALLINT, allowNull: true },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_leave_balance_transactions", ["reference_type","reference_id"], { name: "ix_hrms_leave_balance_transactions_reference_type_reference_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_balance_transactions");
  },
};
