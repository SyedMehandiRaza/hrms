"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_contracts",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        contract_type_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_contract_types", key: "id" }, onDelete: "SET NULL" },
        template_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_contract_templates", key: "id" }, onDelete: "SET NULL" },
        document_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_contract_documents", key: "id" }, onDelete: "SET NULL" },
        project_id: { type: Sequelize.UUID, allowNull: true, references: { model: "projects", key: "id" }, onDelete: "SET NULL" },
        approval_request_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_approval_requests", key: "id" }, onDelete: "SET NULL" },
        reference_no: { type: Sequelize.STRING(60), allowNull: true },
        name: { type: Sequelize.STRING(255), allowNull: false },
        audience_type: { type: Sequelize.ENUM("EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "COLLABORATING_COMPANY"), allowNull: false, defaultValue: "EMPLOYEE" },
        module_label: { type: Sequelize.STRING(80), allowNull: true },
        status: { type: Sequelize.ENUM("DRAFT", "SENT", "VIEWED", "SUBMITTED", "APPROVED", "REJECTED", "EXPIRED", "COMPLETED"), allowNull: false, defaultValue: "DRAFT" },
        signing_order: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        page_count: { type: Sequelize.INTEGER, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        sent_at: { type: Sequelize.DATE, allowNull: true },
        viewed_at: { type: Sequelize.DATE, allowNull: true },
        submitted_at: { type: Sequelize.DATE, allowNull: true },
        approved_at: { type: Sequelize.DATE, allowNull: true },
        completed_at: { type: Sequelize.DATE, allowNull: true },
        expires_at: { type: Sequelize.DATE, allowNull: true },
        start_date: { type: Sequelize.DATEONLY, allowNull: true },
        end_date: { type: Sequelize.DATEONLY, allowNull: true },
        renewal_due: { type: Sequelize.DATEONLY, allowNull: true },
        approved_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        meta: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_contracts", ["employer_id","reference_no"], { unique: true, name: "uq_hrms_contracts_employer_id_reference_no" });
    await queryInterface.addIndex("hrms_contracts", ["employer_id","status"], { name: "ix_hrms_contracts_employer_id_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_contracts");
  },
};
