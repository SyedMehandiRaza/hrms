"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProjectCollaborationRole = sequelize.define(
    "ProjectCollaborationRole",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      name: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.STRING(255) },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "project_collaboration_roles",
      underscored: true,
      paranoid: true,
    }
  );

  ProjectCollaborationRole.associate = (models) => {
    ProjectCollaborationRole.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    ProjectCollaborationRole.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ProjectCollaborationRole.hasMany(models.ProjectCollaborationRolePermission, { as: "projectCollaborationRolePermissions", foreignKey: "role_id" });
    ProjectCollaborationRole.hasMany(models.ProjectInvitation, { as: "projectInvitations", foreignKey: "collaboration_role_id" });
    ProjectCollaborationRole.hasMany(models.ProjectParticipant, { as: "projectParticipants", foreignKey: "collaboration_role_id" });
  };

  return ProjectCollaborationRole;
};
