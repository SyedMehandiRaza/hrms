"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_year_documents",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        financial_year_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: true, references: { model: "employees", key: "id" }, onDelete: "SET NULL" },
        staffing_company_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_staffing_companies", key: "id" }, onDelete: "SET NULL" },
        doc_type: { type: Sequelize.ENUM("ANNUAL_PAY_STATEMENT", "SALARY_REGISTER", "LEAVE_SUMMARY", "LOAN_STATEMENT", "STAFFING_STATEMENT", "OVERTIME_SUMMARY", "HEADCOUNT_REPORT"), allowNull: false },
        storage_key: { type: Sequelize.STRING(500), allowNull: false },
        version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        generated_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        generated_at: { type: Sequelize.DATE, allowNull: false },
        sent_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_year_documents` ADD COLUMN employee_key CHAR(36) GENERATED ALWAYS AS (IFNULL(employee_id, '')) VIRTUAL"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_year_documents` ADD COLUMN staffing_key CHAR(36) GENERATED ALWAYS AS (IFNULL(staffing_company_id, '')) VIRTUAL"
    );
    await queryInterface.addIndex("hrms_year_documents", ["financial_year_id","employee_key","staffing_key","doc_type"], { unique: true, name: "uq_hrms_year_documents_financial_year_id_employee_key_sta_9aa4bc" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_year_documents");
  },
};
