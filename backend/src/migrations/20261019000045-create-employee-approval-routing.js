"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "employee_approval_routing",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        module_key: { type: Sequelize.STRING(40), allowNull: false },
        approval_group_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_approval_groups", key: "id" }, onDelete: "CASCADE" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("employee_approval_routing", ["employee_id","module_key"], { unique: true, name: "uq_employee_approval_routing_employee_id_module_key" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employee_approval_routing");
  },
};
