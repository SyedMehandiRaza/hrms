"use strict";

module.exports = (sequelize, DataTypes) => {
  const Payroll = sequelize.define(
    "Payroll",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      run_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_payroll_runs", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      gross_salary: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      total_deductions: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      net_salary: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      total_working_days: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      total_present_days: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      absent_days: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      leave_days: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      unpaid_leave_count: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      total_worked_hours: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      worked_hours: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      overtime_hours: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      pending_hours: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      overtime_status: { type: DataTypes.ENUM("NONE", "PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "NONE" },
      pdf_url: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM("PENDING", "HOLD", "CREDITED"), allowNull: false, defaultValue: "PENDING" },
    },
    {
      tableName: "hrms_payroll",
      underscored: true,
      paranoid: true,
    }
  );

  Payroll.associate = (models) => {
    Payroll.belongsTo(models.PayrollRun, { as: "run", foreignKey: "run_id" });
    Payroll.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Payroll.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    Payroll.hasMany(models.PayrollItem, { as: "payrollItems", foreignKey: "payroll_id" });
  };

  return Payroll;
};
