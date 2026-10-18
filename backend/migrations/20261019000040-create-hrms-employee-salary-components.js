"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_salary_components",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employee_salary_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_employee_salary", key: "id" }, onDelete: "CASCADE" },
        salary_component_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_salary_components", key: "id" }, onDelete: "CASCADE" },
        calculation_type: { type: Sequelize.ENUM("FIXED", "PERCENTAGE"), allowNull: false, defaultValue: "FIXED" },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        percent_base: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_salary_components", ["employee_salary_id","salary_component_id"], { unique: true, name: "uq_hrms_employee_salary_components_employee_salary_id_sal_0b6866" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_salary_components");
  },
};
