"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeaveBalanceTransaction = sequelize.define(
    "LeaveBalanceTransaction",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      leave_balance_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_balances", key: "id" } },
      leave_type_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" } },
      transaction_type: { type: DataTypes.ENUM("CREDIT", "DEBIT", "ADJUSTMENT", "REVERSAL", "CARRY_FORWARD", "ACCRUAL", "ENCASHMENT", "EXPIRY"), allowNull: false },
      leave_source: { type: DataTypes.ENUM("MANUAL", "SYSTEM", "LEAVE_REQUEST", "ACCRUAL", "ENCASHMENT", "CARRY_FORWARD", "EXPIRY"), allowNull: false, defaultValue: "SYSTEM" },
      transaction_date: { type: DataTypes.DATEONLY, allowNull: false },
      days: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
      balance_before: { type: DataTypes.DECIMAL(6, 2) },
      balance_after: { type: DataTypes.DECIMAL(6, 2) },
      reference_type: { type: DataTypes.STRING(100) },
      reference_id: { type: DataTypes.CHAR(36) },
      reference_code: { type: DataTypes.STRING(100) },
      remarks: { type: DataTypes.TEXT },
      leave_year: { type: DataTypes.SMALLINT },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_leave_balance_transactions",
      underscored: true,
      updatedAt: false,
    }
  );

  LeaveBalanceTransaction.associate = (models) => {
    LeaveBalanceTransaction.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LeaveBalanceTransaction.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    LeaveBalanceTransaction.belongsTo(models.LeaveBalance, { as: "leaveBalance", foreignKey: "leave_balance_id" });
    LeaveBalanceTransaction.belongsTo(models.LeaveType, { as: "leaveType", foreignKey: "leave_type_id" });
    LeaveBalanceTransaction.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
  };

  return LeaveBalanceTransaction;
};
