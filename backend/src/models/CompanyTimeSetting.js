"use strict";

module.exports = (sequelize, DataTypes) => {
  const CompanyTimeSetting = sequelize.define(
    "CompanyTimeSetting",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "Asia/Riyadh" },
      fy_start_month: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
      review_days_before: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      auto_open_next_year: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      reopen_window_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 7 },
      lock_mode: { type: DataTypes.ENUM("YEARLY", "MONTHLY"), allowNull: false, defaultValue: "YEARLY" },
      pending_on_close: { type: DataTypes.ENUM("BLOCK", "CANCEL", "CARRY"), allowNull: false, defaultValue: "BLOCK" },
      offline_backdate_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    },
    {
      tableName: "hrms_company_time_settings",
      underscored: true,
    }
  );

  CompanyTimeSetting.associate = (models) => {
    CompanyTimeSetting.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
  };

  return CompanyTimeSetting;
};
