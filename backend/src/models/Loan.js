"use strict";

module.exports = (sequelize, DataTypes) => {
  const Loan = sequelize.define(
    "Loan",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      loan_number: { type: DataTypes.STRING(30) },
      requested_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      requested_installments: { type: DataTypes.INTEGER, allowNull: false },
      purpose: { type: DataTypes.STRING(500) },
      approved_amount: { type: DataTypes.DECIMAL(12, 2) },
      approved_installments: { type: DataTypes.INTEGER },
      emi_amount: { type: DataTypes.DECIMAL(12, 2) },
      interest_rate: { type: DataTypes.DECIMAL(6, 3) },
      on_insufficient_salary: { type: DataTypes.ENUM("SKIP", "PARTIAL", "FORCE"), allowNull: false, defaultValue: "SKIP" },
      status: { type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED", "DISBURSED", "ACTIVE", "COMPLETED", "CLOSED", "FORECLOSED", "CANCELLED", "MODIFICATION_REQUESTED"), allowNull: false, defaultValue: "PENDING" },
      approver_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      reject_reason: { type: DataTypes.STRING(500) },
      outstanding_principal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      first_deduction_month: { type: DataTypes.DATEONLY },
      recovery_status: { type: DataTypes.ENUM("NONE", "IN_FNF", "RECOVERED", "WRITTEN_OFF"), allowNull: false, defaultValue: "NONE" },
      applied_at: { type: DataTypes.DATE },
      approved_at: { type: DataTypes.DATE },
      disbursed_at: { type: DataTypes.DATE },
      closed_at: { type: DataTypes.DATE },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      meta: { type: DataTypes.JSON },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "hrms_loans",
      underscored: true,
      paranoid: true,
    }
  );

  Loan.associate = (models) => {
    Loan.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Loan.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    Loan.belongsTo(models.User, { as: "approver", foreignKey: "approver_id" });
    Loan.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    Loan.hasMany(models.LoanInstallment, { as: "loanInstallments", foreignKey: "loan_id" });
    Loan.hasMany(models.LoanPayment, { as: "loanPayments", foreignKey: "loan_id" });
    Loan.hasMany(models.LoanSkipRequest, { as: "loanSkipRequests", foreignKey: "loan_id" });
    Loan.hasMany(models.LoanLedger, { as: "loanLedgers", foreignKey: "loan_id" });
    Loan.hasMany(models.LoanAuditLog, { as: "loanAuditLogs", foreignKey: "loan_id" });
  };

  return Loan;
};
