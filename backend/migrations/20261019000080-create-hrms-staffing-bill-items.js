"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_staffing_bill_items",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        bill_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_staffing_bills", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        gross_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        total_deductions: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        net_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        overtime_hours: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
        overtime_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        worked_hours: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
        standard_hours: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
        attendance_factor: { type: Sequelize.DECIMAL(8, 4), allowNull: true },
        meta: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_staffing_bill_items", ["bill_id","employee_id","project_id"], { name: "ix_hrms_staffing_bill_items_bill_id_employee_id_project_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_staffing_bill_items");
  },
};
