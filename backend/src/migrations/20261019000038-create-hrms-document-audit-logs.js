"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_document_audit_logs",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        document_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_employee_documents", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: true, references: { model: "employees", key: "id" }, onDelete: "SET NULL" },
        action: { type: Sequelize.ENUM("UPLOAD", "VIEW", "DOWNLOAD", "UPDATE", "DELETE", "RESTORE", "CONTRACT_APPROVE", "CONTRACT_REJECT"), allowNull: false },
        actor_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        note: { type: Sequelize.TEXT, allowNull: true },
        ip: { type: Sequelize.STRING(64), allowNull: true },
        meta: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_document_audit_logs", ["employer_id","action"], { name: "ix_hrms_document_audit_logs_employer_id_action" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_document_audit_logs");
  },
};
