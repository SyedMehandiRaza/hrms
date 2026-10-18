"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeSalary = sequelize.define(
    "EmployeeSalary",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "SAR" },
      salary_calc_mode: { type: DataTypes.ENUM("MONTHLY_FIXED", "MONTHLY_HOURLY", "HOURLY"), allowNull: false, defaultValue: "MONTHLY_FIXED" },
      working_hours: { type: DataTypes.DECIMAL(6, 2) },
      min_hours: { type: DataTypes.DECIMAL(6, 2) },
      effective_from: { type: DataTypes.DATEONLY, allowNull: false },
      effective_to: { type: DataTypes.DATEONLY },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_employee_salary",
      underscored: true,
    }
  );

  EmployeeSalary.associate = (models) => {
    EmployeeSalary.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeSalary.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeSalary.hasMany(models.EmployeeSalaryComponent, { as: "employeeSalaryComponents", foreignKey: "employee_salary_id" });
    EmployeeSalary.hasMany(models.SalaryIncrementLine, { as: "salaryIncrementLinesAsOldSalary", foreignKey: "old_salary_id" });
    EmployeeSalary.hasMany(models.SalaryIncrementLine, { as: "salaryIncrementLinesAsNewSalary", foreignKey: "new_salary_id" });
    EmployeeSalary.belongsToMany(models.SalaryComponent, { as: "salaryComponents", through: models.EmployeeSalaryComponent, foreignKey: "employee_salary_id", otherKey: "salary_component_id" });
  };

  return EmployeeSalary;
};
