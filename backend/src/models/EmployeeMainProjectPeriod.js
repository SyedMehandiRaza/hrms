"use strict";

// Which project was an employee's main project on each day (workforce D55): one row per period,
// date_to NULL for the current one. "Main project on day X" = the period with
// date_from <= X and (date_to IS NULL or date_to >= X).
module.exports = (sequelize, DataTypes) => {
  const EmployeeMainProjectPeriod = sequelize.define(
    "EmployeeMainProjectPeriod",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      date_from: { type: DataTypes.DATEONLY, allowNull: false },
      date_to: { type: DataTypes.DATEONLY },
    },
    {
      tableName: "hrms_employee_main_project_periods",
      underscored: true,
    }
  );

  EmployeeMainProjectPeriod.associate = (models) => {
    EmployeeMainProjectPeriod.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeMainProjectPeriod.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeMainProjectPeriod.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
  };

  return EmployeeMainProjectPeriod;
};
