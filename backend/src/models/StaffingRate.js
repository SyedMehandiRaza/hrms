"use strict";

module.exports = (sequelize, DataTypes) => {
  const StaffingRate = sequelize.define(
    "StaffingRate",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      staffing_company_id: { type: DataTypes.UUID, references: { model: "hrms_staffing_companies", key: "id" } },
      employee_id: { type: DataTypes.UUID, references: { model: "employees", key: "id" } },
      rate_type: { type: DataTypes.ENUM("OVERTIME_MULTIPLIER", "HOURLY_BILL"), allowNull: false },
      value: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      effective_from: { type: DataTypes.DATEONLY, allowNull: false },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_staffing_rates",
      underscored: true,
    }
  );

  StaffingRate.associate = (models) => {
    StaffingRate.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    StaffingRate.belongsTo(models.StaffingCompany, { as: "staffingCompany", foreignKey: "staffing_company_id" });
    StaffingRate.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    StaffingRate.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
  };

  return StaffingRate;
};
