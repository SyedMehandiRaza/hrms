"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_contract_templates",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        document_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_contract_documents", key: "id" }, onDelete: "SET NULL" },
        name: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        audience_type: { type: Sequelize.ENUM("EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "COLLABORATING_COMPANY"), allowNull: false, defaultValue: "EMPLOYEE" },
        page_count: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.ENUM("DRAFT", "ACTIVE", "ARCHIVED"), allowNull: false, defaultValue: "ACTIVE" },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        meta: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_contract_templates", ["employer_id","audience_type"], { name: "ix_hrms_contract_templates_employer_id_audience_type" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_contract_templates");
  },
};
