"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "offices",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        office_name: { type: Sequelize.STRING(255), allowNull: false },
        office_email: { type: Sequelize.STRING(255), allowNull: true },
        office_phone: { type: Sequelize.STRING(30), allowNull: true },
        office_location: { type: Sequelize.STRING(255), allowNull: true },
        lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
        lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
        status: { type: Sequelize.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
        office_image: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("offices", ["employer_id","status"], { name: "ix_offices_employer_id_status" });
    await queryInterface.addIndex("offices", ["office_name"], { name: "ix_offices_office_name" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("offices");
  },
};
