"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProjectParticipantEdge = sequelize.define(
    "ProjectParticipantEdge",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      parent_employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      child_employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
    },
    {
      tableName: "project_participant_edges",
      underscored: true,
    }
  );

  ProjectParticipantEdge.associate = (models) => {
    ProjectParticipantEdge.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    ProjectParticipantEdge.belongsTo(models.Employer, { as: "parentEmployer", foreignKey: "parent_employer_id" });
    ProjectParticipantEdge.belongsTo(models.Employer, { as: "childEmployer", foreignKey: "child_employer_id" });
  };

  return ProjectParticipantEdge;
};
