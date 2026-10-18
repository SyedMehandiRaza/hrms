"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_exit_visa_trips",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        exit_visa_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_exit_visas", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        departure_date: { type: Sequelize.DATEONLY, allowNull: false },
        expected_return_date: { type: Sequelize.DATEONLY, allowNull: true },
        actual_return_date: { type: Sequelize.DATEONLY, allowNull: true },
        status: { type: Sequelize.ENUM("PENDING_APPROVAL", "PLANNED", "DEPARTED", "RETURNED", "OVERSTAYED", "CANCELLED", "REJECTED"), allowNull: false, defaultValue: "PENDING_APPROVAL" },
        notes: { type: Sequelize.TEXT, allowNull: true },
        recorded_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        approved_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_exit_visa_trips");
  },
};
