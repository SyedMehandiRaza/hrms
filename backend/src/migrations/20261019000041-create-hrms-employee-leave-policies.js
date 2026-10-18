"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_leave_policies",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        leave_policy_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_policies", key: "id" }, onDelete: "CASCADE" },
        effective_from: { type: Sequelize.DATEONLY, allowNull: true },
        effective_to: { type: Sequelize.DATEONLY, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_leave_policies", ["employee_id","leave_policy_id","effective_from"], { unique: true, name: "uq_hrms_employee_leave_policies_employee_id_leave_policy__27c3e2" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_leave_policies");
  },
};
