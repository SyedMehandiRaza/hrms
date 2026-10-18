"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_salary_transactions",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        period_year: { type: Sequelize.SMALLINT, allowNull: false },
        period_month: { type: Sequelize.TINYINT, allowNull: false },
        type: { type: Sequelize.ENUM("EARNING", "DEDUCTION"), allowNull: false },
        is_advance: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        salary_component_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_salary_components", key: "id" }, onDelete: "SET NULL" },
        label: { type: Sequelize.STRING(150), allowNull: false },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_salary_transactions", ["employer_id","employee_id","period_year","period_month"], { name: "ix_hrms_salary_transactions_employer_id_employee_id_perio_5402c0" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_salary_transactions");
  },
};
