"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProjectEmployeeDeployment = sequelize.define(
    "ProjectEmployeeDeployment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      partner_employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      partner_employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      deployed_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      start_date: { type: DataTypes.DATEONLY },
      end_date: { type: DataTypes.DATEONLY },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "project_employee_deployments",
      underscored: true,
    }
  );

  ProjectEmployeeDeployment.associate = (models) => {
    ProjectEmployeeDeployment.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    ProjectEmployeeDeployment.belongsTo(models.Employer, { as: "partnerEmployer", foreignKey: "partner_employer_id" });
    ProjectEmployeeDeployment.belongsTo(models.Employee, { as: "partnerEmployee", foreignKey: "partner_employee_id" });
    ProjectEmployeeDeployment.belongsTo(models.User, { as: "deployedBy", foreignKey: "deployed_by" });
  };

  return ProjectEmployeeDeployment;
};
