"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "project_participants",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        project_id: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        collaboration_role_id: { type: Sequelize.UUID, allowNull: true, references: { model: "project_collaboration_roles", key: "id" }, onDelete: "SET NULL" },
        role_in_project: { type: Sequelize.ENUM("OWNER", "CONSULTANT", "EPC", "SUBCONTRACTOR"), allowNull: false },
        status: { type: Sequelize.ENUM("INVITED", "ACCEPTED", "DECLINED", "REMOVED"), allowNull: false, defaultValue: "INVITED" },
        joined_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("project_participants", ["project_id","employer_id"], { unique: true, name: "uq_project_participants_project_id_employer_id" });
    await queryInterface.addIndex("project_participants", ["employer_id","status"], { name: "ix_project_participants_employer_id_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_participants");
  },
};
