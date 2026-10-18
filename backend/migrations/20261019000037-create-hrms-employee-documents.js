"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_documents",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        document_type_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_document_types", key: "id" }, onDelete: "CASCADE" },
        document_number: { type: Sequelize.STRING(100), allowNull: true },
        issuing_authority: { type: Sequelize.STRING(150), allowNull: true },
        issue_date: { type: Sequelize.DATEONLY, allowNull: true },
        expiry_date: { type: Sequelize.DATEONLY, allowNull: true },
        file_url: { type: Sequelize.TEXT, allowNull: true },
        file_name: { type: Sequelize.STRING(255), allowNull: true },
        file_type: { type: Sequelize.STRING(100), allowNull: true },
        status: { type: Sequelize.ENUM("DRAFT", "PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
        reject_reason: { type: Sequelize.TEXT, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        meta: { type: Sequelize.JSON, allowNull: true },
        uploaded_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_documents", ["employee_id","is_active"], { name: "ix_hrms_employee_documents_employee_id_is_active" });
    await queryInterface.addIndex("hrms_employee_documents", ["status"], { name: "ix_hrms_employee_documents_status" });
    await queryInterface.addIndex("hrms_employee_documents", ["expiry_date"], { name: "ix_hrms_employee_documents_expiry_date" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_documents");
  },
};
