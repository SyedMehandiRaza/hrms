"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_contract_documents",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        name: { type: Sequelize.STRING(255), allowNull: false },
        original_file_name: { type: Sequelize.STRING(255), allowNull: true },
        file_path: { type: Sequelize.STRING(512), allowNull: true },
        file_url: { type: Sequelize.STRING(512), allowNull: true },
        file_type: { type: Sequelize.ENUM("PDF", "DOCX", "DOC"), allowNull: false, defaultValue: "PDF" },
        mime_type: { type: Sequelize.STRING(120), allowNull: true },
        file_size_bytes: { type: Sequelize.BIGINT, allowNull: true },
        page_count: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.ENUM("SAVED", "ARCHIVED"), allowNull: false, defaultValue: "SAVED" },
        uploaded_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        meta: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_contract_documents", ["employer_id","status"], { name: "ix_hrms_contract_documents_employer_id_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_contract_documents");
  },
};
