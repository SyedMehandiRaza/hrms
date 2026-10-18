"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "projects",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        office_id: { type: Sequelize.UUID, allowNull: true, references: { model: "offices", key: "id" }, onDelete: "SET NULL" },
        city_id: { type: Sequelize.UUID, allowNull: true, references: { model: "cities", key: "id" }, onDelete: "SET NULL" },
        project_name: { type: Sequelize.STRING(255), allowNull: false },
        project_code: { type: Sequelize.STRING(100), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        project_location: { type: Sequelize.STRING(255), allowNull: true },
        start_date: { type: Sequelize.DATEONLY, allowNull: true },
        end_date: { type: Sequelize.DATEONLY, allowNull: true },
        status: { type: Sequelize.ENUM("ACTIVE", "INACTIVE", "COMPLETED", "ON_HOLD"), allowNull: false, defaultValue: "ACTIVE" },
        lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
        lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
        radius_meters: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
        allow_offline_attendance: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        photo_url: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("projects", ["employer_id","project_code"], { unique: true, name: "uq_projects_employer_id_project_code" });
    await queryInterface.addIndex("projects", ["status"], { name: "ix_projects_status" });
    await queryInterface.addIndex("projects", ["project_name"], { name: "ix_projects_project_name" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("projects");
  },
};
