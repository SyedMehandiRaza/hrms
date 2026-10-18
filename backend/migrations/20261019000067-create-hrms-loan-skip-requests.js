"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_loan_skip_requests",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        loan_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_loans", key: "id" }, onDelete: "CASCADE" },
        installment_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_loan_installments", key: "id" }, onDelete: "CASCADE" },
        new_installment_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_loan_installments", key: "id" }, onDelete: "SET NULL" },
        reason: { type: Sequelize.STRING(500), allowNull: true },
        status: { type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
        approver_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        decided_at: { type: Sequelize.DATE, allowNull: true },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    // Circular FK declared on hrms_loan_installments; added once hrms_loan_skip_requests exists.
    await queryInterface.addConstraint("hrms_loan_installments", {
      fields: ["generated_from_skip_id"],
      type: "foreign key",
      name: "fk_hrms_loan_installments_generated_from_skip_id",
      references: { table: "hrms_loan_skip_requests", field: "id" },
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("hrms_loan_installments", "fk_hrms_loan_installments_generated_from_skip_id");
    await queryInterface.dropTable("hrms_loan_skip_requests");
  },
};
