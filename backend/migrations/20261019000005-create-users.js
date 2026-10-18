"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "users",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        name: { type: Sequelize.STRING(150), allowNull: true },
        email: { type: Sequelize.STRING(255), allowNull: false },
        phone_number: { type: Sequelize.STRING(30), allowNull: true },
        password: { type: Sequelize.STRING(255), allowNull: true },
        user_status: { type: Sequelize.ENUM("ACTIVE", "INACTIVE", "BLOCKED", "SUSPENDED"), allowNull: false, defaultValue: "ACTIVE" },
        is_email_verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_number_verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        signup_by: { type: Sequelize.ENUM("EMAIL", "PHONE", "GOOGLE", "APPLE"), allowNull: true },
        provider: { type: Sequelize.ENUM("EMAIL", "PHONE", "GOOGLE", "APPLE"), allowNull: true },
        provider_id: { type: Sequelize.STRING(255), allowNull: true },
        signup_step: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        lang_key: { type: Sequelize.ENUM("EN", "AR"), allowNull: false, defaultValue: "EN" },
        fcm_token: { type: Sequelize.TEXT, allowNull: true },
        last_seen_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("users", ["email"], { unique: true, name: "uq_users_email" });
    await queryInterface.addIndex("users", ["phone_number"], { unique: true, name: "uq_users_phone_number" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("users");
  },
};
