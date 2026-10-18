"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_sessions",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        hrms_account_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_accounts", key: "id" }, onDelete: "CASCADE" },
        access_token_hash: { type: Sequelize.STRING(128), allowNull: false },
        refresh_token_hash: { type: Sequelize.STRING(128), allowNull: false },
        status: { type: Sequelize.ENUM("ACTIVE", "REVOKED", "EXPIRED"), allowNull: false, defaultValue: "ACTIVE" },
        user_agent: { type: Sequelize.TEXT, allowNull: true },
        ip_address: { type: Sequelize.STRING(80), allowNull: true },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        revoked_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_sessions", ["access_token_hash"], { unique: true, name: "uq_hrms_sessions_access_token_hash" });
    await queryInterface.addIndex("hrms_sessions", ["refresh_token_hash"], { unique: true, name: "uq_hrms_sessions_refresh_token_hash" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_sessions");
  },
};
