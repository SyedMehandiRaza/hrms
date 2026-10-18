"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_number_sequences",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        doc_type: { type: Sequelize.ENUM("STAFFING_BILL", "LOAN", "CONTRACT", "PAYROLL_RUN"), allowNull: false },
        financial_year_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" }, onDelete: "CASCADE" },
        last_no: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_number_sequences", ["employer_id","doc_type","financial_year_id"], { unique: true, name: "uq_hrms_number_sequences_employer_id_doc_type_financial_year_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_number_sequences");
  },
};
