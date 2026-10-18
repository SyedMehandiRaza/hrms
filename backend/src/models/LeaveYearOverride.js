"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeaveYearOverride = sequelize.define(
    "LeaveYearOverride",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      financial_year_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" } },
      leave_balance_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_balances", key: "id" } },
      carry_days: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      encash_days: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      reason: { type: DataTypes.STRING(500), allowNull: false },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_leave_year_overrides",
      underscored: true,
    }
  );

  LeaveYearOverride.associate = (models) => {
    LeaveYearOverride.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
    LeaveYearOverride.belongsTo(models.LeaveBalance, { as: "leaveBalance", foreignKey: "leave_balance_id" });
    LeaveYearOverride.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
  };

  return LeaveYearOverride;
};
