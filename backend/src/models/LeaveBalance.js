"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeaveBalance = sequelize.define(
    "LeaveBalance",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      leave_type_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" } },
      leave_policy_id: { type: DataTypes.UUID, references: { model: "hrms_leave_policies", key: "id" } },
      financial_year_id: { type: DataTypes.UUID, references: { model: "hrms_financial_years", key: "id" } },
      balance_year: { type: DataTypes.SMALLINT, allowNull: false },
      opening_balance: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      accrued_balance: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      carry_forward_balance: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      adjusted_balance: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      consumed_balance: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      encashed_balance: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      expired_balance: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      total_allocated: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      available_balance: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      last_accrual_date: { type: DataTypes.DATEONLY },
      last_encashment_date: { type: DataTypes.DATEONLY },
      status: { type: DataTypes.ENUM("OPEN", "CLOSED"), allowNull: false, defaultValue: "OPEN" },
      carry_forward_expires_on: { type: DataTypes.DATEONLY },
      carry_forward_used: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "hrms_leave_balances",
      underscored: true,
      paranoid: true,
    }
  );

  LeaveBalance.associate = (models) => {
    LeaveBalance.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LeaveBalance.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    LeaveBalance.belongsTo(models.LeaveType, { as: "leaveType", foreignKey: "leave_type_id" });
    LeaveBalance.belongsTo(models.LeavePolicy, { as: "leavePolicy", foreignKey: "leave_policy_id" });
    LeaveBalance.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
    LeaveBalance.hasMany(models.LeaveBalanceTransaction, { as: "leaveBalanceTransactions", foreignKey: "leave_balance_id" });
    LeaveBalance.hasMany(models.LeaveYearOverride, { as: "leaveYearOverrides", foreignKey: "leave_balance_id" });
  };

  return LeaveBalance;
};
