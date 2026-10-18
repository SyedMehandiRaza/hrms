"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_overtime_requests",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        work_date: { type: Sequelize.DATEONLY, allowNull: false },
        start_time: { type: Sequelize.TIME, allowNull: true },
        end_time: { type: Sequelize.TIME, allowNull: true },
        overtime_hours: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
        reason: { type: Sequelize.TEXT, allowNull: true },
        attachment_url: { type: Sequelize.TEXT, allowNull: true },
        batch_id: { type: Sequelize.STRING(40), allowNull: true },
        status: { type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
        approval_request_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_approval_requests", key: "id" }, onDelete: "SET NULL" },
        reviewed_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        reviewed_at: { type: Sequelize.DATE, allowNull: true },
        reject_reason: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_overtime_requests", ["employer_id","employee_id","work_date"], { name: "ix_hrms_overtime_requests_employer_id_employee_id_work_date" });
    await queryInterface.addIndex("hrms_overtime_requests", ["batch_id"], { name: "ix_hrms_overtime_requests_batch_id" });
    await queryInterface.addIndex("hrms_overtime_requests", ["status"], { name: "ix_hrms_overtime_requests_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_overtime_requests");
  },
};
