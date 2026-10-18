"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_salary_components",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        name: { type: Sequelize.STRING(100), allowNull: false },
        code: { type: Sequelize.STRING(50), allowNull: true },
        type: { type: Sequelize.ENUM("EARNING", "DEDUCTION"), allowNull: false },
        description: { type: Sequelize.STRING(255), allowNull: true },
        is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_salary_components", ["employer_id","name"], { unique: true, name: "uq_hrms_salary_components_employer_id_name" });
    await queryInterface.addIndex("hrms_salary_components", ["employer_id","code"], { unique: true, name: "uq_hrms_salary_components_employer_id_code" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_salary_components");
  },
};
