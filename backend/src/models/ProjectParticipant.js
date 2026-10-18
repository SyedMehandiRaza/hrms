"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProjectParticipant = sequelize.define(
    "ProjectParticipant",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      collaboration_role_id: { type: DataTypes.UUID, references: { model: "project_collaboration_roles", key: "id" } },
      role_in_project: { type: DataTypes.ENUM("OWNER", "CONSULTANT", "EPC", "SUBCONTRACTOR"), allowNull: false },
      status: { type: DataTypes.ENUM("INVITED", "ACCEPTED", "DECLINED", "REMOVED"), allowNull: false, defaultValue: "INVITED" },
      joined_at: { type: DataTypes.DATE },
    },
    {
      tableName: "project_participants",
      underscored: true,
      paranoid: true,
    }
  );

  ProjectParticipant.associate = (models) => {
    ProjectParticipant.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    ProjectParticipant.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ProjectParticipant.belongsTo(models.ProjectCollaborationRole, { as: "collaborationRole", foreignKey: "collaboration_role_id" });
  };

  return ProjectParticipant;
};
