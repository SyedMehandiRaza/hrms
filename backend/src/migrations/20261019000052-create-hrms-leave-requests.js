"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_requests",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        leave_type_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" }, onDelete: "CASCADE" },
        leave_policy_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_leave_policies", key: "id" }, onDelete: "SET NULL" },
        approval_request_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_approval_requests", key: "id" }, onDelete: "SET NULL" },
        request_code: { type: Sequelize.STRING(100), allowNull: false },
        from_date: { type: Sequelize.DATEONLY, allowNull: false },
        to_date: { type: Sequelize.DATEONLY, allowNull: false },
        total_days: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
        paid_days: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        unpaid_days: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        reason: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED", "CANCELLED", "PARTIALLY_APPROVED"), allowNull: false, defaultValue: "PENDING" },
        applied_at: { type: Sequelize.DATE, allowNull: false },
        approved_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        approved_at: { type: Sequelize.DATE, allowNull: true },
        rejected_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        rejected_at: { type: Sequelize.DATE, allowNull: true },
        reject_reason: { type: Sequelize.TEXT, allowNull: true },
        cancelled_at: { type: Sequelize.DATE, allowNull: true },
        cancel_reason: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_leave_requests", ["employer_id","request_code"], { unique: true, name: "uq_hrms_leave_requests_employer_id_request_code" });
    await queryInterface.addIndex("hrms_leave_requests", ["employee_id","from_date"], { name: "ix_hrms_leave_requests_employee_id_from_date" });
    await queryInterface.addIndex("hrms_leave_requests", ["status"], { name: "ix_hrms_leave_requests_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_requests");
  },
};
