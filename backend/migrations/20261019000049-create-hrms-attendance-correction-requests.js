"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_attendance_correction_requests",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        attendance_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_attendance", key: "id" }, onDelete: "SET NULL" },
        work_date: { type: Sequelize.DATEONLY, allowNull: false },
        correction_type: { type: Sequelize.ENUM("ADD_CHECK_IN", "ADD_CHECK_OUT", "UPDATE_TIMES", "MARK_PRESENT"), allowNull: false },
        requested_check_in: { type: Sequelize.DATE, allowNull: true },
        requested_check_out: { type: Sequelize.DATE, allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: true },
        attachment_url: { type: Sequelize.TEXT, allowNull: true },
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
    await queryInterface.addIndex("hrms_attendance_correction_requests", ["employer_id","employee_id","work_date"], { name: "ix_hrms_attendance_correction_requests_employer_id_employ_112c40" });
    await queryInterface.addIndex("hrms_attendance_correction_requests", ["status"], { name: "ix_hrms_attendance_correction_requests_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_attendance_correction_requests");
  },
};
