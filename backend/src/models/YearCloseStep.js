"use strict";

module.exports = (sequelize, DataTypes) => {
  const YearCloseStep = sequelize.define(
    "YearCloseStep",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      financial_year_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" } },
      step: { type: DataTypes.ENUM("READINESS", "LEAVE", "PAYROLL", "BILLING", "SETUP", "CLOSE"), allowNull: false },
      status: { type: DataTypes.ENUM("PENDING", "IN_PROGRESS", "DONE", "SKIPPED"), allowNull: false, defaultValue: "PENDING" },
      result: { type: DataTypes.JSON },
      done_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      done_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_year_close_steps",
      underscored: true,
    }
  );

  YearCloseStep.associate = (models) => {
    YearCloseStep.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
    YearCloseStep.belongsTo(models.User, { as: "doneBy", foreignKey: "done_by" });
  };

  return YearCloseStep;
};
