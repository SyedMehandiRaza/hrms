"use strict";

module.exports = (sequelize, DataTypes) => {
  const ExitSetting = sequelize.define(
    "ExitSetting",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      default_notice_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      default_cooling_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 180 },
      default_allow_leave_during_notice: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      default_encash_leave: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      block_loans_during_notice: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_exit_settings",
      underscored: true,
    }
  );

  ExitSetting.associate = (models) => {
    ExitSetting.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
  };

  return ExitSetting;
};
