"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_loan_ledger",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        loan_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_loans", key: "id" }, onDelete: "CASCADE" },
        entry_type: { type: Sequelize.ENUM("DISBURSEMENT", "PAYMENT", "PENALTY", "WAIVER", "SKIP_DEFERRAL", "FORECLOSURE_SETTLEMENT", "FNF_RECOVERY", "REVERSAL"), allowNull: false },
        direction: { type: Sequelize.ENUM("DEBIT", "CREDIT"), allowNull: false },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        installment_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_loan_installments", key: "id" }, onDelete: "SET NULL" },
        payment_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_loan_payments", key: "id" }, onDelete: "SET NULL" },
        balance_after: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        entry_date: { type: Sequelize.DATEONLY, allowNull: false },
        remarks: { type: Sequelize.STRING(255), allowNull: true },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_loan_ledger");
  },
};
