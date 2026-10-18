"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_attachments",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        leave_request_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_requests", key: "id" }, onDelete: "CASCADE" },
        file_name: { type: Sequelize.STRING(255), allowNull: true },
        file_url: { type: Sequelize.TEXT, allowNull: true },
        file_type: { type: Sequelize.STRING(100), allowNull: true },
        uploaded_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_attachments");
  },
};
