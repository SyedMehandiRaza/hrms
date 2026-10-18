"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProjectCollaborationRolePermission = sequelize.define(
    "ProjectCollaborationRolePermission",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      role_id: { type: DataTypes.UUID, allowNull: false, references: { model: "project_collaboration_roles", key: "id" } },
      module_key: { type: DataTypes.STRING(100), allowNull: false },
      can_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_create: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_update: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_delete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "project_collaboration_role_permissions",
      underscored: true,
    }
  );

  ProjectCollaborationRolePermission.associate = (models) => {
    ProjectCollaborationRolePermission.belongsTo(models.ProjectCollaborationRole, { as: "role", foreignKey: "role_id" });
  };

  return ProjectCollaborationRolePermission;
};
