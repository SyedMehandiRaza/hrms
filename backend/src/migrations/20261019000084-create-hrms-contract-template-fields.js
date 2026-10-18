"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_contract_template_fields",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        template_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_contract_templates", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        page_no: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        field_type: { type: Sequelize.ENUM("INPUT", "CHECKBOX", "SIGNATURE", "DB_COLUMN"), allowNull: false },
        label: { type: Sequelize.STRING(160), allowNull: true },
        field_key: { type: Sequelize.STRING(120), allowNull: true },
        checked_value: { type: Sequelize.STRING(160), allowNull: true },
        db_source: { type: Sequelize.ENUM("EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "COLLABORATING_COMPANY"), allowNull: true },
        db_column: { type: Sequelize.STRING(120), allowNull: true },
        pos_x: { type: Sequelize.DECIMAL(6, 3), allowNull: false, defaultValue: 0 },
        pos_y: { type: Sequelize.DECIMAL(6, 3), allowNull: false, defaultValue: 0 },
        width: { type: Sequelize.DECIMAL(6, 3), allowNull: true },
        height: { type: Sequelize.DECIMAL(6, 3), allowNull: true },
        is_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        assigned_role: { type: Sequelize.ENUM("PRIMARY_SIGNER", "APPROVER", "VIEWER", "WITNESS"), allowNull: true },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        meta: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_contract_template_fields", ["template_id","page_no"], { name: "ix_hrms_contract_template_fields_template_id_page_no" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_contract_template_fields");
  },
};
