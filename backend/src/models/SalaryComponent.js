"use strict";

module.exports = (sequelize, DataTypes) => {
  const SalaryComponent = sequelize.define(
    "SalaryComponent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      name: { type: DataTypes.STRING(100), allowNull: false },
      code: { type: DataTypes.STRING(50) },
      type: { type: DataTypes.ENUM("EARNING", "DEDUCTION"), allowNull: false },
      description: { type: DataTypes.STRING(255) },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // Basic, Housing, Transport: the wizard's locked first rows (workforce D42).
      is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_salary_components",
      underscored: true,
    }
  );

  SalaryComponent.associate = (models) => {
    SalaryComponent.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    SalaryComponent.hasMany(models.EmployeeSalaryComponent, { as: "employeeSalaryComponents", foreignKey: "salary_component_id" });
    SalaryComponent.hasMany(models.SalaryTransaction, { as: "salaryTransactions", foreignKey: "salary_component_id" });
    SalaryComponent.hasMany(models.PayrollItem, { as: "payrollItems", foreignKey: "salary_component_id" });
    SalaryComponent.belongsToMany(models.EmployeeSalary, { as: "employeeSalaries", through: models.EmployeeSalaryComponent, foreignKey: "salary_component_id", otherKey: "employee_salary_id" });
  };

  return SalaryComponent;
};
