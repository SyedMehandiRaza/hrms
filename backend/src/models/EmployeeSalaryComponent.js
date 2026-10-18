"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeSalaryComponent = sequelize.define(
    "EmployeeSalaryComponent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employee_salary_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_employee_salary", key: "id" } },
      salary_component_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_salary_components", key: "id" } },
      calculation_type: { type: DataTypes.ENUM("FIXED", "PERCENTAGE"), allowNull: false, defaultValue: "FIXED" },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      percent_base: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_employee_salary_components",
      underscored: true,
    }
  );

  EmployeeSalaryComponent.associate = (models) => {
    EmployeeSalaryComponent.belongsTo(models.EmployeeSalary, { as: "employeeSalary", foreignKey: "employee_salary_id" });
    EmployeeSalaryComponent.belongsTo(models.SalaryComponent, { as: "salaryComponent", foreignKey: "salary_component_id" });
  };

  return EmployeeSalaryComponent;
};
