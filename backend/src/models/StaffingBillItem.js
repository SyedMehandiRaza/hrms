"use strict";

module.exports = (sequelize, DataTypes) => {
  const StaffingBillItem = sequelize.define(
    "StaffingBillItem",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      bill_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_staffing_bills", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      gross_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_deductions: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      net_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      overtime_hours: { type: DataTypes.DECIMAL(8, 2) },
      overtime_amount: { type: DataTypes.DECIMAL(12, 2) },
      worked_hours: { type: DataTypes.DECIMAL(8, 2) },
      standard_hours: { type: DataTypes.DECIMAL(8, 2) },
      attendance_factor: { type: DataTypes.DECIMAL(8, 4) },
      meta: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_staffing_bill_items",
      underscored: true,
    }
  );

  StaffingBillItem.associate = (models) => {
    StaffingBillItem.belongsTo(models.StaffingBill, { as: "bill", foreignKey: "bill_id" });
    StaffingBillItem.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    StaffingBillItem.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    StaffingBillItem.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
  };

  return StaffingBillItem;
};
