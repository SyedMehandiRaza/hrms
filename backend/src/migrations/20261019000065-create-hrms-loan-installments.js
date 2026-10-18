"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_loan_installments",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        loan_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_loans", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        installment_no: { type: Sequelize.INTEGER, allowNull: false },
        due_date: { type: Sequelize.DATEONLY, allowNull: false },
        period_month: { type: Sequelize.TINYINT, allowNull: true },
        period_year: { type: Sequelize.SMALLINT, allowNull: true },
        emi_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        principal_component: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        interest_component: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        opening_balance: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        closing_balance: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        status: { type: Sequelize.ENUM("PENDING", "PAID", "PARTIALLY_PAID", "SKIPPED", "OVERDUE"), allowNull: false, defaultValue: "PENDING" },
        paid_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        paid_date: { type: Sequelize.DATEONLY, allowNull: true },
        schedule_version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        generated_from_skip_id: { type: Sequelize.UUID, allowNull: true },
        version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_loan_installments", ["loan_id","installment_no","schedule_version"], { unique: true, name: "uq_hrms_loan_installments_loan_id_installment_no_schedule_44402d" });
    await queryInterface.addIndex("hrms_loan_installments", ["due_date","status"], { name: "ix_hrms_loan_installments_due_date_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_loan_installments");
  },
};
