"use strict";

module.exports = (sequelize, DataTypes) => {
  const SalaryIncrementLine = sequelize.define(
    "SalaryIncrementLine",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      batch_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_salary_increment_batches", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      old_salary_id: { type: DataTypes.UUID, references: { model: "hrms_employee_salary", key: "id" } },
      new_salary_id: { type: DataTypes.UUID, references: { model: "hrms_employee_salary", key: "id" } },
      old_gross: { type: DataTypes.DECIMAL(14, 2) },
      new_gross: { type: DataTypes.DECIMAL(14, 2) },
      old_basic: { type: DataTypes.DECIMAL(12, 2) },
      new_basic: { type: DataTypes.DECIMAL(12, 2) },
      excluded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      note: { type: DataTypes.STRING(500) },
    },
    {
      tableName: "hrms_salary_increment_lines",
      underscored: true,
    }
  );

  SalaryIncrementLine.associate = (models) => {
    SalaryIncrementLine.belongsTo(models.SalaryIncrementBatch, { as: "batch", foreignKey: "batch_id" });
    SalaryIncrementLine.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    SalaryIncrementLine.belongsTo(models.EmployeeSalary, { as: "oldSalary", foreignKey: "old_salary_id" });
    SalaryIncrementLine.belongsTo(models.EmployeeSalary, { as: "newSalary", foreignKey: "new_salary_id" });
  };

  return SalaryIncrementLine;
};
