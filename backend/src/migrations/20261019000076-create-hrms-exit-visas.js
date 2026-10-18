"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_exit_visas",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        visa_type: { type: Sequelize.ENUM("SINGLE_EXIT", "MULTIPLE_EXIT", "FINAL_EXIT"), allowNull: false },
        status: { type: Sequelize.ENUM("PENDING_APPROVAL", "APPROVED", "REJECTED", "ACTIVE", "EXHAUSTED", "EXPIRED", "CANCELLED"), allowNull: false, defaultValue: "PENDING_APPROVAL" },
        requested_from: { type: Sequelize.DATEONLY, allowNull: true },
        requested_to: { type: Sequelize.DATEONLY, allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: true },
        visa_number: { type: Sequelize.STRING(100), allowNull: true },
        valid_from: { type: Sequelize.DATEONLY, allowNull: true },
        valid_until: { type: Sequelize.DATEONLY, allowNull: true },
        final_exit_date: { type: Sequelize.DATEONLY, allowNull: true },
        max_exits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        exits_used: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        approval_request_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_approval_requests", key: "id" }, onDelete: "SET NULL" },
        document_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_employee_documents", key: "id" }, onDelete: "SET NULL" },
        applied_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        applied_at: { type: Sequelize.DATE, allowNull: true },
        reviewed_at: { type: Sequelize.DATE, allowNull: true },
        reject_reason: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_exit_visas", ["employer_id","employee_id"], { name: "ix_hrms_exit_visas_employer_id_employee_id" });
    await queryInterface.addIndex("hrms_exit_visas", ["status"], { name: "ix_hrms_exit_visas_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_exit_visas");
  },
};
