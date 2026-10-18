"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_approval_requests",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        approval_group_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_approval_groups", key: "id" }, onDelete: "CASCADE" },
        module_key: { type: Sequelize.STRING(100), allowNull: false },
        entity_type: { type: Sequelize.STRING(100), allowNull: false },
        entity_id: { type: Sequelize.CHAR(36), allowNull: false },
        request_code: { type: Sequelize.STRING(100), allowNull: false },
        requested_by: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        current_level: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        total_levels: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        final_status: { type: Sequelize.ENUM("PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "CANCELLED"), allowNull: false, defaultValue: "PENDING" },
        remarks: { type: Sequelize.TEXT, allowNull: true },
        requested_at: { type: Sequelize.DATE, allowNull: false },
        completed_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_approval_requests", ["employer_id","request_code"], { unique: true, name: "uq_hrms_approval_requests_employer_id_request_code" });
    await queryInterface.addIndex("hrms_approval_requests", ["entity_type","entity_id"], { name: "ix_hrms_approval_requests_entity_type_entity_id" });
    await queryInterface.addIndex("hrms_approval_requests", ["final_status"], { name: "ix_hrms_approval_requests_final_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_approval_requests");
  },
};
