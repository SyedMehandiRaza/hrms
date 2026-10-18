"use strict";

module.exports = (sequelize, DataTypes) => {
  const CompanyShift = sequelize.define(
    "CompanyShift",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      name: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "GENERAL" },
      start_time: { type: DataTypes.TIME, allowNull: false },
      end_time: { type: DataTypes.TIME, allowNull: false },
    },
    {
      tableName: "company_shifts",
      underscored: true,
      paranoid: true,
    }
  );

  CompanyShift.associate = (models) => {
    CompanyShift.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    CompanyShift.hasMany(models.ShiftTimeHistory, { as: "shiftTimeHistories", foreignKey: "shift_id" });
    CompanyShift.hasMany(models.ShiftWeekOff, { as: "shiftWeekOffs", foreignKey: "shift_id" });
    CompanyShift.hasMany(models.Employee, { as: "employees", foreignKey: "shift_id" });
    CompanyShift.hasMany(models.EmployeeShiftHistory, { as: "employeeShiftHistories", foreignKey: "shift_id" });
  };

  return CompanyShift;
};
