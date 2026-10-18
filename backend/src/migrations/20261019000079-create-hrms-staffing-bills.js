"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_staffing_bills",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        staffing_company_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_staffing_companies", key: "id" }, onDelete: "CASCADE" },
        bill_no: { type: Sequelize.STRING(30), allowNull: false },
        period_month: { type: Sequelize.TINYINT, allowNull: false },
        period_year: { type: Sequelize.SMALLINT, allowNull: false },
        status: { type: Sequelize.ENUM("DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PAID"), allowNull: false, defaultValue: "DRAFT" },
        reject_reason: { type: Sequelize.TEXT, allowNull: true },
        currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: "SAR" },
        total_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        approval_request_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_approval_requests", key: "id" }, onDelete: "SET NULL" },
        generated_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        generated_at: { type: Sequelize.DATE, allowNull: true },
        sent_to_portal: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        sent_at: { type: Sequelize.DATE, allowNull: true },
        paid_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_staffing_bills` ADD COLUMN live_key TINYINT GENERATED ALWAYS AS (IF(status <> 'REJECTED' AND deleted_at IS NULL, 1, NULL)) STORED"
    );
    await queryInterface.addIndex("hrms_staffing_bills", ["employer_id","bill_no"], { unique: true, name: "uq_hrms_staffing_bills_employer_id_bill_no" });
    await queryInterface.addIndex("hrms_staffing_bills", ["employer_id","staffing_company_id","period_year","period_month","live_key"], { unique: true, name: "uq_hrms_staffing_bills_employer_id_staffing_company_id_pe_5a9d80" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_staffing_bills");
  },
};
