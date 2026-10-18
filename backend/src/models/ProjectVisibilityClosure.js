"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProjectVisibilityClosure = sequelize.define(
    "ProjectVisibilityClosure",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      ancestor_employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      descendant_employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      depth: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    {
      tableName: "project_visibility_closure",
      underscored: true,
      updatedAt: false,
    }
  );

  ProjectVisibilityClosure.associate = (models) => {
    ProjectVisibilityClosure.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    ProjectVisibilityClosure.belongsTo(models.Employer, { as: "ancestorEmployer", foreignKey: "ancestor_employer_id" });
    ProjectVisibilityClosure.belongsTo(models.Employer, { as: "descendantEmployer", foreignKey: "descendant_employer_id" });
  };

  return ProjectVisibilityClosure;
};
