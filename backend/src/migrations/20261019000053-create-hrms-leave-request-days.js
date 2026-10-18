"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_request_days",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        leave_request_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_requests", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        leave_date: { type: Sequelize.DATEONLY, allowNull: false },
        session_type: { type: Sequelize.ENUM("FULL_DAY", "FIRST_HALF", "SECOND_HALF"), allowNull: false, defaultValue: "FULL_DAY" },
        leave_value: { type: Sequelize.DECIMAL(3, 1), allowNull: false, defaultValue: 1 },
        is_weekly_off: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_holiday: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        holiday_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_holidays", key: "id" }, onDelete: "SET NULL" },
        holiday_name: { type: Sequelize.STRING(200), allowNull: true },
        is_sandwich_leave: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_paid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        is_counted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        leave_year: { type: Sequelize.SMALLINT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_leave_request_days", ["employee_id","leave_date"], { name: "ix_hrms_leave_request_days_employee_id_leave_date" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_request_days");
  },
};
