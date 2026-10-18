"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeProject = sequelize.define(
    "EmployeeProject",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      start_date: { type: DataTypes.DATEONLY },
      end_date: { type: DataTypes.DATEONLY },
      main_project: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      main_project_date_start: { type: DataTypes.DATEONLY },
      main_project_date_end: { type: DataTypes.DATEONLY },
    },
    {
      tableName: "employee_projects",
      underscored: true,
    }
  );

  EmployeeProject.associate = (models) => {
    EmployeeProject.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeProject.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeProject.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
  };

  return EmployeeProject;
};
