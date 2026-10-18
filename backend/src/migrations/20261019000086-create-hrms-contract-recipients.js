"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_contract_recipients",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        contract_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_contracts", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        recipient_type: { type: Sequelize.ENUM("EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "EXTERNAL", "COLLABORATING_COMPANY"), allowNull: false },
        employee_id: { type: Sequelize.UUID, allowNull: true, references: { model: "employees", key: "id" }, onDelete: "SET NULL" },
        staffing_company_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_staffing_companies", key: "id" }, onDelete: "SET NULL" },
        partner_employer_id: { type: Sequelize.UUID, allowNull: true, references: { model: "employers", key: "id" }, onDelete: "SET NULL" },
        recipient_name: { type: Sequelize.STRING(160), allowNull: true },
        recipient_email: { type: Sequelize.STRING(160), allowNull: true },
        recipient_phone: { type: Sequelize.STRING(40), allowNull: true },
        role: { type: Sequelize.ENUM("PRIMARY_SIGNER", "APPROVER", "VIEWER", "WITNESS"), allowNull: false, defaultValue: "PRIMARY_SIGNER" },
        signing_sequence: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        status: { type: Sequelize.ENUM("PENDING", "SENT", "VIEWED", "SIGNED", "SUBMITTED", "DECLINED"), allowNull: false, defaultValue: "PENDING" },
        access_token_hash: { type: Sequelize.STRING(128), allowNull: true },
        color_index: { type: Sequelize.INTEGER, allowNull: true },
        sent_at: { type: Sequelize.DATE, allowNull: true },
        viewed_at: { type: Sequelize.DATE, allowNull: true },
        signed_at: { type: Sequelize.DATE, allowNull: true },
        submitted_at: { type: Sequelize.DATE, allowNull: true },
        reject_reason: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_contract_recipients", ["access_token_hash"], { unique: true, name: "uq_hrms_contract_recipients_access_token_hash" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_contract_recipients");
  },
};
