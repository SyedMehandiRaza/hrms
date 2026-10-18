"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_approval_groups",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        group_name: { type: Sequelize.STRING(150), allowNull: false },
        group_code: { type: Sequelize.STRING(100), allowNull: false },
        module_key: { type: Sequelize.STRING(100), allowNull: false },
        scope: { type: Sequelize.ENUM("GLOBAL", "PROJECT"), allowNull: false, defaultValue: "GLOBAL" },
        project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        description: { type: Sequelize.TEXT, allowNull: true },
        total_levels: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_approval_groups", ["employer_id","group_code"], { unique: true, name: "uq_hrms_approval_groups_employer_id_group_code" });
    await queryInterface.addIndex("hrms_approval_groups", ["employer_id","module_key"], { name: "ix_hrms_approval_groups_employer_id_module_key" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_approval_groups");
  },
};
