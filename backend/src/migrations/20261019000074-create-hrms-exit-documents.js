"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_exit_documents",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        exit_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_employee_exits", key: "id" }, onDelete: "CASCADE" },
        doc_type: { type: Sequelize.ENUM("TERMINATION_LETTER", "RELIEVING_LETTER", "FNF_STATEMENT", "CLEARANCE_CERTIFICATE"), allowNull: false },
        storage_key: { type: Sequelize.STRING(500), allowNull: false },
        version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        is_final: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        generated_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        generated_at: { type: Sequelize.DATE, allowNull: false },
        sent_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_exit_documents", ["exit_id","doc_type"], { unique: true, name: "uq_hrms_exit_documents_exit_id_doc_type" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_exit_documents");
  },
};
