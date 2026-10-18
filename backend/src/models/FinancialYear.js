"use strict";

module.exports = (sequelize, DataTypes) => {
  const FinancialYear = sequelize.define(
    "FinancialYear",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      year_key: { type: DataTypes.SMALLINT, allowNull: false },
      label: { type: DataTypes.STRING(20), allowNull: false },
      start_date: { type: DataTypes.DATEONLY, allowNull: false },
      end_date: { type: DataTypes.DATEONLY, allowNull: false },
      status: { type: DataTypes.ENUM("PLANNED", "OPEN", "CLOSING", "CLOSED"), allowNull: false, defaultValue: "PLANNED" },
      is_locked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      opened_at: { type: DataTypes.DATE },
      closing_started_at: { type: DataTypes.DATE },
      closed_at: { type: DataTypes.DATE },
      closed_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      reopened_at: { type: DataTypes.DATE },
      reopened_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      reopen_until: { type: DataTypes.DATE },
      totals: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_financial_years",
      underscored: true,
    }
  );

  FinancialYear.associate = (models) => {
    FinancialYear.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    FinancialYear.belongsTo(models.User, { as: "closedBy", foreignKey: "closed_by" });
    FinancialYear.belongsTo(models.User, { as: "reopenedBy", foreignKey: "reopened_by" });
    FinancialYear.hasMany(models.NumberSequence, { as: "numberSequences", foreignKey: "financial_year_id" });
    FinancialYear.hasMany(models.PeriodLock, { as: "periodLocks", foreignKey: "financial_year_id" });
    FinancialYear.hasMany(models.LeaveBalance, { as: "leaveBalances", foreignKey: "financial_year_id" });
    FinancialYear.hasMany(models.LeaveYearOverride, { as: "leaveYearOverrides", foreignKey: "financial_year_id" });
    FinancialYear.hasMany(models.LeaveEncashmentRequest, { as: "leaveEncashmentRequests", foreignKey: "financial_year_id" });
    FinancialYear.hasMany(models.SalaryIncrementBatch, { as: "salaryIncrementBatches", foreignKey: "financial_year_id" });
  };

  return FinancialYear;
};
