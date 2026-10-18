"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_exits",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        exit_type: { type: Sequelize.ENUM("RESIGNATION", "TERMINATION"), allowNull: false },
        reason_category: { type: Sequelize.STRING(40), allowNull: false },
        reason: { type: Sequelize.TEXT, allowNull: false },
        notice_start_date: { type: Sequelize.DATEONLY, allowNull: false },
        notice_days: { type: Sequelize.INTEGER, allowNull: false },
        preferred_last_day: { type: Sequelize.DATEONLY, allowNull: true },
        original_last_working_day: { type: Sequelize.DATEONLY, allowNull: false },
        last_working_day: { type: Sequelize.DATEONLY, allowNull: false },
        allow_leave_during_notice: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        encash_leave: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        loan_handling: { type: Sequelize.ENUM("RECOVER", "WRITE_OFF", "SETTLED", "NONE"), allowNull: false, defaultValue: "NONE" },
        settlement_scope_project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        settlement_month: { type: Sequelize.TINYINT, allowNull: true },
        settlement_year: { type: Sequelize.SMALLINT, allowNull: true },
        settlement_snapshot: { type: Sequelize.JSON, allowNull: true },
        rehire_eligible: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        cooling_period_days: { type: Sequelize.INTEGER, allowNull: true },
        rehire_allowed_from: { type: Sequelize.DATEONLY, allowNull: true },
        status: { type: Sequelize.ENUM("IN_NOTICE", "EXITED", "COMPLETED", "CANCELLED"), allowNull: false, defaultValue: "IN_NOTICE" },
        raised_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        exited_at: { type: Sequelize.DATE, allowNull: true },
        completed_at: { type: Sequelize.DATE, allowNull: true },
        cancelled_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        cancelled_at: { type: Sequelize.DATE, allowNull: true },
        cancel_reason: { type: Sequelize.STRING(500), allowNull: true },
        confirmed_at: { type: Sequelize.DATE, allowNull: true },
        confirmed_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        confirm_mode: { type: Sequelize.ENUM("ON_LWD", "IMMEDIATE"), allowNull: true },
        confirm_override_reason: { type: Sequelize.STRING(500), allowNull: true },
        offline_clearance_key: { type: Sequelize.STRING(500), allowNull: true },
        offline_clearance_name: { type: Sequelize.STRING(255), allowNull: true },
        offline_clearance_mime: { type: Sequelize.STRING(100), allowNull: true },
        offline_clearance_size: { type: Sequelize.INTEGER, allowNull: true },
        offline_clearance_uploaded_at: { type: Sequelize.DATE, allowNull: true },
        offline_clearance_uploaded_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_exits", ["employer_id","status"], { name: "ix_hrms_employee_exits_employer_id_status" });
    await queryInterface.addIndex("hrms_employee_exits", ["employee_id","status"], { name: "ix_hrms_employee_exits_employee_id_status" });
    await queryInterface.addIndex("hrms_employee_exits", ["last_working_day","status"], { name: "ix_hrms_employee_exits_last_working_day_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_exits");
  },
};
