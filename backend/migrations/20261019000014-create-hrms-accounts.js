"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_accounts",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        access_level: { type: Sequelize.ENUM("ADMIN", "SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"), allowNull: false },
        role_id: { type: Sequelize.UUID, allowNull: true, references: { model: "roles", key: "id" }, onDelete: "SET NULL" },
        status: { type: Sequelize.ENUM("ACTIVE", "INACTIVE", "SUSPENDED"), allowNull: false, defaultValue: "ACTIVE" },
        last_login_at: { type: Sequelize.DATE, allowNull: true },
        password_setup_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        password_set_at: { type: Sequelize.DATE, allowNull: true },
        password_setup_token_hash: { type: Sequelize.STRING(128), allowNull: true },
        password_setup_token_expires_at: { type: Sequelize.DATE, allowNull: true },
        invited_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        invited_at: { type: Sequelize.DATE, allowNull: true },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_accounts", ["user_id","employer_id"], { unique: true, name: "uq_hrms_accounts_user_id_employer_id" });
    await queryInterface.addIndex("hrms_accounts", ["employer_id","access_level"], { name: "ix_hrms_accounts_employer_id_access_level" });
    await queryInterface.addIndex("hrms_accounts", ["password_setup_token_hash"], { name: "ix_hrms_accounts_password_setup_token_hash" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_accounts");
  },
};
