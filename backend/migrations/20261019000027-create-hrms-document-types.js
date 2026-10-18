"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_document_types",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        category: { type: Sequelize.ENUM("LEGAL", "IDENTITY", "PROFESSIONAL", "SITE", "CONTRACT", "GENERAL"), allowNull: false },
        code: { type: Sequelize.STRING(100), allowNull: false },
        label: { type: Sequelize.STRING(150), allowNull: false },
        description: { type: Sequelize.STRING(255), allowNull: true },
        requires_number: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        requires_expiry: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        requires_issuer: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_document_types", ["employer_id","code"], { unique: true, name: "uq_hrms_document_types_employer_id_code" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_document_types");
  },
};
