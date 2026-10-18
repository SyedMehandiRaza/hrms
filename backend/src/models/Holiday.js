"use strict";

module.exports = (sequelize, DataTypes) => {
  const Holiday = sequelize.define(
    "Holiday",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      city_id: { type: DataTypes.UUID, references: { model: "cities", key: "id" } },
      holiday_name: { type: DataTypes.STRING(200), allowNull: false },
      holiday_date: { type: DataTypes.DATEONLY, allowNull: false },
      holiday_type: { type: DataTypes.ENUM("PUBLIC", "FESTIVAL", "NATIONAL", "COMPANY", "OPTIONAL", "WEEKLY_OFF"), allowNull: false, defaultValue: "PUBLIC" },
      is_global: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_optional: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_half_day: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      from_time: { type: DataTypes.TIME },
      to_time: { type: DataTypes.TIME },
      description: { type: DataTypes.TEXT },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      source_holiday_id: { type: DataTypes.UUID, references: { model: "hrms_holidays", key: "id" } },
    },
    {
      tableName: "hrms_holidays",
      underscored: true,
      paranoid: true,
    }
  );

  Holiday.associate = (models) => {
    Holiday.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Holiday.belongsTo(models.City, { as: "city", foreignKey: "city_id" });
    Holiday.belongsTo(models.Holiday, { as: "sourceHoliday", foreignKey: "source_holiday_id" });
    Holiday.hasMany(models.Holiday, { as: "holidaysAsSourceHoliday", foreignKey: "source_holiday_id" });
    Holiday.hasMany(models.LeaveRequestDay, { as: "leaveRequestDays", foreignKey: "holiday_id" });
  };

  return Holiday;
};
