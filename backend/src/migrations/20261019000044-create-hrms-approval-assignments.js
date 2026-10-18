"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_approval_assignments",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        module_key: { type: Sequelize.STRING(100), allowNull: false },
        approval_group_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_approval_groups", key: "id" }, onDelete: "SET NULL" },
        project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_approval_assignments` ADD COLUMN project_key CHAR(36) GENERATED ALWAYS AS (IFNULL(project_id, '')) VIRTUAL"
    );
    await queryInterface.addIndex("hrms_approval_assignments", ["employer_id","module_key","project_key"], { unique: true, name: "uq_hrms_approval_assignments_employer_id_module_key_project_key" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_approval_assignments");
  },
};
