"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeShiftHistory = sequelize.define(
    "EmployeeShiftHistory",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      shift_id: { type: DataTypes.UUID, allowNull: false, references: { model: "company_shifts", key: "id" } },
      effective_from: { type: DataTypes.DATEONLY, allowNull: false },
    },
    {
      tableName: "hrms_employee_shift_history",
      underscored: true,
    }
  );

  EmployeeShiftHistory.associate = (models) => {
    EmployeeShiftHistory.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeShiftHistory.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeShiftHistory.belongsTo(models.CompanyShift, { as: "shift", foreignKey: "shift_id" });
  };

  return EmployeeShiftHistory;
};
