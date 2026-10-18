"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_shift_time_history",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        shift_id: { type: Sequelize.UUID, allowNull: false, references: { model: "company_shifts", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        start_time: { type: Sequelize.TIME, allowNull: false },
        end_time: { type: Sequelize.TIME, allowNull: false },
        effective_from: { type: Sequelize.DATEONLY, allowNull: false },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_shift_time_history", ["shift_id","effective_from"], { unique: true, name: "uq_hrms_shift_time_history_shift_id_effective_from" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_shift_time_history");
  },
};
