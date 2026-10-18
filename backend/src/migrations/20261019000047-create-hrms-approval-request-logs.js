"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_approval_request_logs",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        approval_request_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_approval_requests", key: "id" }, onDelete: "CASCADE" },
        approval_group_member_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_approval_group_members", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        level_no: { type: Sequelize.INTEGER, allowNull: false },
        status: { type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED", "SKIPPED"), allowNull: false, defaultValue: "PENDING" },
        comments: { type: Sequelize.TEXT, allowNull: true },
        acted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_approval_request_logs");
  },
};
