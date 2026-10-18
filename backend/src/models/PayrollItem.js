"use strict";

module.exports = (sequelize, DataTypes) => {
  const PayrollItem = sequelize.define(
    "PayrollItem",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      payroll_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_payroll", key: "id" } },
      type: { type: DataTypes.ENUM("EARNING", "DEDUCTION", "INCENTIVE"), allowNull: false },
      label: { type: DataTypes.STRING(150), allowNull: false },
      salary_component_id: { type: DataTypes.UUID, references: { model: "hrms_salary_components", key: "id" } },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      is_auto: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      added_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_payroll_items",
      underscored: true,
    }
  );

  PayrollItem.associate = (models) => {
    PayrollItem.belongsTo(models.Payroll, { as: "payroll", foreignKey: "payroll_id" });
    PayrollItem.belongsTo(models.SalaryComponent, { as: "salaryComponent", foreignKey: "salary_component_id" });
    PayrollItem.belongsTo(models.User, { as: "addedBy", foreignKey: "added_by" });
  };

  return PayrollItem;
};
