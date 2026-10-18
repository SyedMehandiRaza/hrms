"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_project_history",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        project_id: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        previous_project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        action: { type: Sequelize.ENUM("ASSIGNED", "REMOVED", "MOVED_IN", "MOVED_OUT"), allowNull: false },
        actioned_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        notes: { type: Sequelize.TEXT, allowNull: true },
        actioned_at: { type: Sequelize.DATE, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_project_history", ["employee_id","project_id"], { name: "ix_hrms_employee_project_history_employee_id_project_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_project_history");
  },
};
