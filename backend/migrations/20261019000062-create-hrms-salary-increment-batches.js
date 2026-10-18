"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_salary_increment_batches",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        financial_year_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_financial_years", key: "id" }, onDelete: "SET NULL" },
        title: { type: Sequelize.STRING(150), allowNull: false },
        kind: { type: Sequelize.ENUM("BULK", "SINGLE"), allowNull: false, defaultValue: "BULK" },
        type: { type: Sequelize.ENUM("PERCENT", "AMOUNT"), allowNull: false },
        value: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        applies_to: { type: Sequelize.ENUM("BASIC_ONLY", "ALL_FIXED"), allowNull: false, defaultValue: "BASIC_ONLY" },
        effective_month: { type: Sequelize.TINYINT, allowNull: false },
        effective_year: { type: Sequelize.SMALLINT, allowNull: false },
        effective_date: { type: Sequelize.DATEONLY, allowNull: true },
        reason: { type: Sequelize.STRING(500), allowNull: true },
        filters: { type: Sequelize.JSON, allowNull: true },
        status: { type: Sequelize.ENUM("DRAFT", "APPLIED", "REVERTED"), allowNull: false, defaultValue: "DRAFT" },
        applied_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        applied_at: { type: Sequelize.DATE, allowNull: true },
        reverted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_salary_increment_batches", ["employer_id","status"], { name: "ix_hrms_salary_increment_batches_employer_id_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_salary_increment_batches");
  },
};
