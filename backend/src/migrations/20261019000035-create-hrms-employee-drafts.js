"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_drafts",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        full_name: { type: Sequelize.STRING(255), allowNull: true },
        email: { type: Sequelize.STRING(255), allowNull: true },
        current_step: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        data: { type: Sequelize.JSON, allowNull: false },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_employee_drafts", ["employer_id","updated_at"], { name: "ix_hrms_employee_drafts_employer_id_updated_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_drafts");
  },
};
