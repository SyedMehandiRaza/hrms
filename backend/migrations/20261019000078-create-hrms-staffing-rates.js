"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_staffing_rates",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        staffing_company_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_staffing_companies", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: true, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        rate_type: { type: Sequelize.ENUM("OVERTIME_MULTIPLIER", "HOURLY_BILL"), allowNull: false },
        value: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        effective_from: { type: Sequelize.DATEONLY, allowNull: false },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_staffing_rates", ["employer_id","staffing_company_id","employee_id","rate_type","effective_from"], { name: "ix_hrms_staffing_rates_employer_id_staffing_company_id_em_1942cf" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_staffing_rates");
  },
};
