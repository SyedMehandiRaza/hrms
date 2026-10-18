"use strict";

module.exports = (sequelize, DataTypes) => {
  const ShiftTimeHistory = sequelize.define(
    "ShiftTimeHistory",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      shift_id: { type: DataTypes.UUID, allowNull: false, references: { model: "company_shifts", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      start_time: { type: DataTypes.TIME, allowNull: false },
      end_time: { type: DataTypes.TIME, allowNull: false },
      effective_from: { type: DataTypes.DATEONLY, allowNull: false },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_shift_time_history",
      underscored: true,
    }
  );

  ShiftTimeHistory.associate = (models) => {
    ShiftTimeHistory.belongsTo(models.CompanyShift, { as: "shift", foreignKey: "shift_id" });
    ShiftTimeHistory.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ShiftTimeHistory.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
  };

  return ShiftTimeHistory;
};
