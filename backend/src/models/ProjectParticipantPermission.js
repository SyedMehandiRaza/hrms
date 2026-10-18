"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProjectParticipantPermission = sequelize.define(
    "ProjectParticipantPermission",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      granted_by_employer_id: { type: DataTypes.UUID, references: { model: "employers", key: "id" } },
      module_key: { type: DataTypes.STRING(100), allowNull: false },
      can_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_create: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_update: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_delete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "project_participant_permissions",
      underscored: true,
    }
  );

  ProjectParticipantPermission.associate = (models) => {
    ProjectParticipantPermission.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    ProjectParticipantPermission.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ProjectParticipantPermission.belongsTo(models.Employer, { as: "grantedByEmployer", foreignKey: "granted_by_employer_id" });
  };

  return ProjectParticipantPermission;
};
