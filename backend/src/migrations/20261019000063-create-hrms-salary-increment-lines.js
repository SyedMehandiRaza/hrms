"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_salary_increment_lines",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        batch_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_salary_increment_batches", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        old_salary_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_employee_salary", key: "id" }, onDelete: "SET NULL" },
        new_salary_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_employee_salary", key: "id" }, onDelete: "SET NULL" },
        old_gross: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
        new_gross: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
        old_basic: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        new_basic: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        excluded: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        note: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_salary_increment_lines", ["batch_id","employee_id"], { unique: true, name: "uq_hrms_salary_increment_lines_batch_id_employee_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_salary_increment_lines");
  },
};
