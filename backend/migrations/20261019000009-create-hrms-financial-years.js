"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_financial_years",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        year_key: { type: Sequelize.SMALLINT, allowNull: false },
        label: { type: Sequelize.STRING(20), allowNull: false },
        start_date: { type: Sequelize.DATEONLY, allowNull: false },
        end_date: { type: Sequelize.DATEONLY, allowNull: false },
        status: { type: Sequelize.ENUM("PLANNED", "OPEN", "CLOSING", "CLOSED"), allowNull: false, defaultValue: "PLANNED" },
        is_locked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        opened_at: { type: Sequelize.DATE, allowNull: true },
        closing_started_at: { type: Sequelize.DATE, allowNull: true },
        closed_at: { type: Sequelize.DATE, allowNull: true },
        closed_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        reopened_at: { type: Sequelize.DATE, allowNull: true },
        reopened_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        reopen_until: { type: Sequelize.DATE, allowNull: true },
        totals: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_financial_years", ["employer_id","year_key"], { unique: true, name: "uq_hrms_financial_years_employer_id_year_key" });
    await queryInterface.addIndex("hrms_financial_years", ["employer_id","status"], { name: "ix_hrms_financial_years_employer_id_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_financial_years");
  },
};
