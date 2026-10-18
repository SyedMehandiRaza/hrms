"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_staffing_companies",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        user_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        name: { type: Sequelize.STRING(255), allowNull: false },
        code: { type: Sequelize.STRING(100), allowNull: true },
        email: { type: Sequelize.STRING(255), allowNull: true },
        phone: { type: Sequelize.STRING(30), allowNull: true },
        contact_person_name: { type: Sequelize.STRING(255), allowNull: true },
        contact_person_email: { type: Sequelize.STRING(255), allowNull: true },
        contact_person_phone: { type: Sequelize.STRING(30), allowNull: true },
        city: { type: Sequelize.STRING(100), allowNull: true },
        address: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
        login_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        must_change_password: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        signature_url: { type: Sequelize.STRING(512), allowNull: true },
        signature_type: { type: Sequelize.ENUM("DRAWN", "TYPED", "UPLOADED"), allowNull: true },
        signature_updated_at: { type: Sequelize.DATE, allowNull: true },
        company_image: { type: Sequelize.STRING(500), allowNull: true },
        created_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_staffing_companies", ["employer_id","code"], { unique: true, name: "uq_hrms_staffing_companies_employer_id_code" });
    await queryInterface.addIndex("hrms_staffing_companies", ["employer_id","status"], { name: "ix_hrms_staffing_companies_employer_id_status" });
    await queryInterface.addIndex("hrms_staffing_companies", ["name"], { name: "ix_hrms_staffing_companies_name" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_staffing_companies");
  },
};
