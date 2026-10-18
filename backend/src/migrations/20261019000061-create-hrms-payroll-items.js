"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_payroll_items",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        payroll_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_payroll", key: "id" }, onDelete: "CASCADE" },
        type: { type: Sequelize.ENUM("EARNING", "DEDUCTION", "INCENTIVE"), allowNull: false },
        label: { type: Sequelize.STRING(150), allowNull: false },
        salary_component_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_salary_components", key: "id" }, onDelete: "SET NULL" },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        is_auto: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        added_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_payroll_items");
  },
};
