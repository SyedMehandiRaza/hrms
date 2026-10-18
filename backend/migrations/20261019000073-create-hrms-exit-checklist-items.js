"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_exit_checklist_items",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        exit_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_employee_exits", key: "id" }, onDelete: "CASCADE" },
        category: { type: Sequelize.ENUM("LOAN", "ASSETS", "FINANCE", "PROJECT", "ADMINISTRATION", "IT", "HR", "OTHER"), allowNull: false },
        label: { type: Sequelize.STRING(150), allowNull: false },
        is_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.ENUM("PENDING", "DONE", "NA"), allowNull: false, defaultValue: "PENDING" },
        note: { type: Sequelize.STRING(500), allowNull: true },
        actioned_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        actioned_at: { type: Sequelize.DATE, allowNull: true },
        auto_key: { type: Sequelize.STRING(30), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_exit_checklist_items", ["exit_id","category"], { name: "ix_hrms_exit_checklist_items_exit_id_category" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_exit_checklist_items");
  },
};
