"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "employee_projects",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        start_date: { type: Sequelize.DATEONLY, allowNull: true },
        end_date: { type: Sequelize.DATEONLY, allowNull: true },
        main_project: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        main_project_date_start: { type: Sequelize.DATEONLY, allowNull: true },
        main_project_date_end: { type: Sequelize.DATEONLY, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("employee_projects", ["employee_id","project_id"], { unique: true, name: "uq_employee_projects_employee_id_project_id" });
    await queryInterface.addIndex("employee_projects", ["employee_id","is_active"], { name: "ix_employee_projects_employee_id_is_active" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employee_projects");
  },
};
