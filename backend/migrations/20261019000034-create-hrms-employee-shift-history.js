"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_shift_history",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        shift_id: { type: Sequelize.UUID, allowNull: false, references: { model: "company_shifts", key: "id" }, onDelete: "CASCADE" },
        effective_from: { type: Sequelize.DATEONLY, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_shift_history", ["employee_id","effective_from"], { unique: true, name: "uq_hrms_employee_shift_history_employee_id_effective_from" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_shift_history");
  },
};
