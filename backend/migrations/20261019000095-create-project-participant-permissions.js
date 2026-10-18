"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "project_participant_permissions",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        project_id: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        granted_by_employer_id: { type: Sequelize.UUID, allowNull: true, references: { model: "employers", key: "id" }, onDelete: "SET NULL" },
        module_key: { type: Sequelize.STRING(100), allowNull: false },
        can_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        can_create: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        can_update: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        can_delete: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("project_participant_permissions", ["project_id","employer_id","module_key"], { unique: true, name: "uq_project_participant_permissions_project_id_employer_id_c8c30b" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_participant_permissions");
  },
};
