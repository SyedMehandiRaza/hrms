"use strict";

module.exports = (sequelize, DataTypes) => {
  const YearEvent = sequelize.define(
    "YearEvent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      financial_year_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" } },
      event_type: { type: DataTypes.ENUM("OPENED", "AUTO_OPENED", "REVIEW_STARTED", "READINESS_CHECKED", "LEAVE_CLOSED", "LEAVE_OVERRIDE", "HOLIDAYS_COPIED", "WEEKOFFS_COPIED", "POLICY_VERSIONED", "INCREMENT_APPLIED", "INCREMENT_REVERTED", "REPORTS_GENERATED", "MONTH_LOCKED", "MONTH_UNLOCKED", "CLOSED", "REOPENED"), allowNull: false },
      payload: { type: DataTypes.JSON },
      actor_user_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_year_events",
      underscored: true,
      updatedAt: false,
    }
  );

  YearEvent.associate = (models) => {
    YearEvent.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
    YearEvent.belongsTo(models.User, { as: "actorUser", foreignKey: "actor_user_id" });
  };

  return YearEvent;
};
