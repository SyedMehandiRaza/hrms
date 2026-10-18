"use strict";

module.exports = (sequelize, DataTypes) => {
  const ShiftWeekOff = sequelize.define(
    "ShiftWeekOff",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      shift_id: { type: DataTypes.UUID, allowNull: false, references: { model: "company_shifts", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      off_date: { type: DataTypes.DATEONLY, allowNull: false },
    },
    {
      tableName: "shift_week_offs",
      underscored: true,
    }
  );

  ShiftWeekOff.associate = (models) => {
    ShiftWeekOff.belongsTo(models.CompanyShift, { as: "shift", foreignKey: "shift_id" });
    ShiftWeekOff.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
  };

  return ShiftWeekOff;
};
