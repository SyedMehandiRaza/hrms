"use strict";

module.exports = (sequelize, DataTypes) => {
  const PeriodLock = sequelize.define(
    "PeriodLock",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      financial_year_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" } },
      period_year: { type: DataTypes.SMALLINT, allowNull: false },
      period_month: { type: DataTypes.TINYINT, allowNull: false },
      module: { type: DataTypes.ENUM("ALL", "ATTENDANCE", "LEAVE", "PAYROLL", "BILLING"), allowNull: false, defaultValue: "ALL" },
      locked_at: { type: DataTypes.DATE, allowNull: false },
      locked_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      reason: { type: DataTypes.STRING(500) },
    },
    {
      tableName: "hrms_period_locks",
      underscored: true,
    }
  );

  PeriodLock.associate = (models) => {
    PeriodLock.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    PeriodLock.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
    PeriodLock.belongsTo(models.User, { as: "lockedBy", foreignKey: "locked_by" });
  };

  return PeriodLock;
};
