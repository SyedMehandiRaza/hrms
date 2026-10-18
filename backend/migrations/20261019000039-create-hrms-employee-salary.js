"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_salary",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: "SAR" },
        salary_calc_mode: { type: Sequelize.ENUM("MONTHLY_FIXED", "MONTHLY_HOURLY", "HOURLY"), allowNull: false, defaultValue: "MONTHLY_FIXED" },
        working_hours: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
        min_hours: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
        effective_from: { type: Sequelize.DATEONLY, allowNull: false },
        effective_to: { type: Sequelize.DATEONLY, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_salary", ["employee_id","is_active"], { name: "ix_hrms_employee_salary_employee_id_is_active" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_salary");
  },
};
