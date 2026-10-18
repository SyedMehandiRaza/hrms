"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "notifications",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        type: { type: Sequelize.STRING(60), allowNull: false },
        title: { type: Sequelize.STRING(200), allowNull: false },
        body: { type: Sequelize.TEXT, allowNull: true },
        entity_type: { type: Sequelize.STRING(100), allowNull: true },
        entity_id: { type: Sequelize.CHAR(36), allowNull: true },
        read_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("notifications", ["user_id","read_at"], { name: "ix_notifications_user_id_read_at" });
    await queryInterface.addIndex("notifications", ["entity_type","entity_id"], { name: "ix_notifications_entity_type_entity_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("notifications");
  },
};
