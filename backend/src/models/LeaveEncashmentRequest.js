"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeaveEncashmentRequest = sequelize.define(
    "LeaveEncashmentRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      leave_type_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" } },
      leave_balance_id: { type: DataTypes.UUID, references: { model: "hrms_leave_balances", key: "id" } },
      financial_year_id: { type: DataTypes.UUID, references: { model: "hrms_financial_years", key: "id" } },
      days: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
      payout_year: { type: DataTypes.SMALLINT, allowNull: false },
      payout_month: { type: DataTypes.TINYINT, allowNull: false },
      daily_rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      amount_estimated: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      amount_final: { type: DataTypes.DECIMAL(12, 2) },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "SAR" },
      status: { type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED", "CANCELLED", "PAID"), allowNull: false, defaultValue: "PENDING" },
      reason: { type: DataTypes.STRING(500) },
      reject_reason: { type: DataTypes.STRING(500) },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      salary_transaction_id: { type: DataTypes.UUID, references: { model: "hrms_salary_transactions", key: "id" } },
      balance_transaction_id: { type: DataTypes.UUID, references: { model: "hrms_leave_balance_transactions", key: "id" } },
      requested_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      raised_on_behalf: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      approved_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      approved_at: { type: DataTypes.DATE },
      cancelled_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_leave_encashment_requests",
      underscored: true,
    }
  );

  LeaveEncashmentRequest.associate = (models) => {
    LeaveEncashmentRequest.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LeaveEncashmentRequest.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    LeaveEncashmentRequest.belongsTo(models.LeaveType, { as: "leaveType", foreignKey: "leave_type_id" });
    LeaveEncashmentRequest.belongsTo(models.LeaveBalance, { as: "leaveBalance", foreignKey: "leave_balance_id" });
    LeaveEncashmentRequest.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
    LeaveEncashmentRequest.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    LeaveEncashmentRequest.belongsTo(models.SalaryTransaction, { as: "salaryTransaction", foreignKey: "salary_transaction_id" });
    LeaveEncashmentRequest.belongsTo(models.LeaveBalanceTransaction, { as: "balanceTransaction", foreignKey: "balance_transaction_id" });
    LeaveEncashmentRequest.belongsTo(models.User, { as: "requestedBy", foreignKey: "requested_by" });
    LeaveEncashmentRequest.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by" });
  };

  return LeaveEncashmentRequest;
};
