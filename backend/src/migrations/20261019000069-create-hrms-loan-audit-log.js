"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_loan_audit_log",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        entity_type: { type: Sequelize.ENUM("LOAN", "INSTALLMENT", "SKIP_REQUEST", "PAYMENT"), allowNull: false },
        entity_id: { type: Sequelize.CHAR(36), allowNull: false },
        loan_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_loans", key: "id" }, onDelete: "SET NULL" },
        action: { type: Sequelize.STRING(50), allowNull: false },
        actor_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        old_values: { type: Sequelize.JSON, allowNull: true },
        new_values: { type: Sequelize.JSON, allowNull: true },
        remarks: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_loan_audit_log", ["entity_type","entity_id"], { name: "ix_hrms_loan_audit_log_entity_type_entity_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_loan_audit_log");
  },
};
