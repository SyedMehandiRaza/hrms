"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_exit_checklist_templates",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        category: { type: Sequelize.ENUM("LOAN", "ASSETS", "FINANCE", "PROJECT", "ADMINISTRATION", "IT", "HR", "OTHER"), allowNull: false },
        label: { type: Sequelize.STRING(150), allowNull: false },
        is_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_exit_checklist_templates", ["employer_id","category","label"], { unique: true, name: "uq_hrms_exit_checklist_templates_employer_id_category_label" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_exit_checklist_templates");
  },
};
