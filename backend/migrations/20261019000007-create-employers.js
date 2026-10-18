"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "employers",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        industry_type_id: { type: Sequelize.UUID, allowNull: true, references: { model: "industry_types", key: "id" }, onDelete: "SET NULL" },
        company_name: { type: Sequelize.STRING(255), allowNull: false },
        company_logo: { type: Sequelize.TEXT, allowNull: true },
        contact_person_name: { type: Sequelize.STRING(255), allowNull: true },
        company_email: { type: Sequelize.STRING(255), allowNull: true },
        company_phone_number: { type: Sequelize.STRING(30), allowNull: true },
        company_website: { type: Sequelize.STRING(255), allowNull: true },
        company_description: { type: Sequelize.TEXT, allowNull: true },
        address: { type: Sequelize.TEXT, allowNull: true },
        is_company_verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        verification_requested: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        employer_status: { type: Sequelize.ENUM("ACTIVE", "INACTIVE", "BANNED"), allowNull: false, defaultValue: "ACTIVE" },
        email_notification: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        sms_notification: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("employers", ["user_id"], { unique: true, name: "uq_employers_user_id" });
    await queryInterface.addIndex("employers", ["company_name"], { type: "FULLTEXT", name: "ft_employers_company_name" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employers");
  },
};
