"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "project_invitations",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        project_id: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        inviting_employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        invited_employer_id: { type: Sequelize.UUID, allowNull: true, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        parent_employer_id: { type: Sequelize.UUID, allowNull: true, references: { model: "employers", key: "id" }, onDelete: "SET NULL" },
        collaboration_role_id: { type: Sequelize.UUID, allowNull: true, references: { model: "project_collaboration_roles", key: "id" }, onDelete: "SET NULL" },
        invitation_batch_id: { type: Sequelize.CHAR(36), allowNull: true },
        invited_email: { type: Sequelize.STRING(255), allowNull: true },
        role_in_project: { type: Sequelize.ENUM("CONSULTANT", "EPC", "SUBCONTRACTOR"), allowNull: false },
        token: { type: Sequelize.STRING(120), allowNull: false },
        status: { type: Sequelize.ENUM("PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"), allowNull: false, defaultValue: "PENDING" },
        expires_at: { type: Sequelize.DATE, allowNull: true },
        responded_at: { type: Sequelize.DATE, allowNull: true },
        parent_approval_status: { type: Sequelize.ENUM("NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "NOT_REQUIRED" },
        parent_approved_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("project_invitations", ["token"], { unique: true, name: "uq_project_invitations_token" });
    await queryInterface.addIndex("project_invitations", ["project_id","status"], { name: "ix_project_invitations_project_id_status" });
    await queryInterface.addIndex("project_invitations", ["invited_email"], { name: "ix_project_invitations_invited_email" });
    await queryInterface.addIndex("project_invitations", ["invitation_batch_id"], { name: "ix_project_invitations_invitation_batch_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_invitations");
  },
};
