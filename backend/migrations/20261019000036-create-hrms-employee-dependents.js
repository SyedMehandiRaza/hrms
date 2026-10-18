"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_employee_dependents",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        full_name: { type: Sequelize.STRING(255), allowNull: false },
        relationship: { type: Sequelize.ENUM("SPOUSE", "CHILD", "PARENT", "OTHER"), allowNull: false },
        id_details: { type: Sequelize.STRING(255), allowNull: true },
        date_of_birth: { type: Sequelize.DATEONLY, allowNull: true },
        gender: { type: Sequelize.ENUM("MALE", "FEMALE", "OTHER"), allowNull: true },
        nationality: { type: Sequelize.STRING(100), allowNull: true },
        contact: { type: Sequelize.STRING(30), allowNull: true },
        photo_url: { type: Sequelize.TEXT, allowNull: true },
        document_url: { type: Sequelize.TEXT, allowNull: true },
        document_name: { type: Sequelize.STRING(255), allowNull: true },
        status: { type: Sequelize.ENUM("PENDING", "VERIFIED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
        reviewed_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        reviewed_at: { type: Sequelize.DATE, allowNull: true },
        reject_reason: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_employee_dependents");
  },
};
