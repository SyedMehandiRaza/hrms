"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_types",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        leave_name: { type: Sequelize.STRING(150), allowNull: false },
        leave_code: { type: Sequelize.STRING(100), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        is_paid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        allow_half_day: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        requires_document: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_leave_types", ["employer_id","leave_code"], { unique: true, name: "uq_hrms_leave_types_employer_id_leave_code" });
    await queryInterface.addIndex("hrms_leave_types", ["employer_id","leave_name"], { unique: true, name: "uq_hrms_leave_types_employer_id_leave_name" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_types");
  },
};
