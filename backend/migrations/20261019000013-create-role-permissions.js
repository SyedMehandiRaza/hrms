"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "role_permissions",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        role_id: { type: Sequelize.UUID, allowNull: false, references: { model: "roles", key: "id" }, onDelete: "CASCADE" },
        module_id: { type: Sequelize.UUID, allowNull: false, references: { model: "modules", key: "id" }, onDelete: "CASCADE" },
        can_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        can_create: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        can_update: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        can_delete: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("role_permissions", ["role_id","module_id"], { unique: true, name: "uq_role_permissions_role_id_module_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("role_permissions");
  },
};
