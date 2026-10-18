"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_approval_group_members",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        approval_group_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_approval_groups", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        level_no: { type: Sequelize.INTEGER, allowNull: false },
        is_mandatory: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        can_skip: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_approval_group_members", ["approval_group_id","employee_id","level_no"], { unique: true, name: "uq_hrms_approval_group_members_approval_group_id_employee_08c45d" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_approval_group_members");
  },
};
