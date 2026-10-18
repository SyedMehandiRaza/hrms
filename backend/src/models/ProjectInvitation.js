"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProjectInvitation = sequelize.define(
    "ProjectInvitation",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      inviting_employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      invited_employer_id: { type: DataTypes.UUID, references: { model: "employers", key: "id" } },
      parent_employer_id: { type: DataTypes.UUID, references: { model: "employers", key: "id" } },
      collaboration_role_id: { type: DataTypes.UUID, references: { model: "project_collaboration_roles", key: "id" } },
      invitation_batch_id: { type: DataTypes.CHAR(36) },
      invited_email: { type: DataTypes.STRING(255) },
      role_in_project: { type: DataTypes.ENUM("CONSULTANT", "EPC", "SUBCONTRACTOR"), allowNull: false },
      token: { type: DataTypes.STRING(120), allowNull: false },
      status: { type: DataTypes.ENUM("PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"), allowNull: false, defaultValue: "PENDING" },
      expires_at: { type: DataTypes.DATE },
      responded_at: { type: DataTypes.DATE },
      parent_approval_status: { type: DataTypes.ENUM("NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "NOT_REQUIRED" },
      parent_approved_at: { type: DataTypes.DATE },
    },
    {
      tableName: "project_invitations",
      underscored: true,
    }
  );

  ProjectInvitation.associate = (models) => {
    ProjectInvitation.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    ProjectInvitation.belongsTo(models.Employer, { as: "invitingEmployer", foreignKey: "inviting_employer_id" });
    ProjectInvitation.belongsTo(models.Employer, { as: "invitedEmployer", foreignKey: "invited_employer_id" });
    ProjectInvitation.belongsTo(models.Employer, { as: "parentEmployer", foreignKey: "parent_employer_id" });
    ProjectInvitation.belongsTo(models.ProjectCollaborationRole, { as: "collaborationRole", foreignKey: "collaboration_role_id" });
  };

  return ProjectInvitation;
};
