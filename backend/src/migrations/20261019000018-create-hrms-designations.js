"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_designations",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        department_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_departments", key: "id" }, onDelete: "CASCADE" },
        name: { type: Sequelize.STRING(150), allowNull: false },
        code: { type: Sequelize.STRING(50), allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_designations", ["employer_id","department_id","name"], { unique: true, name: "uq_hrms_designations_employer_id_department_id_name" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_designations");
  },
};
