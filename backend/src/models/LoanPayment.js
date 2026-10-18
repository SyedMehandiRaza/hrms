"use strict";

module.exports = (sequelize, DataTypes) => {
  const LoanPayment = sequelize.define(
    "LoanPayment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      loan_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_loans", key: "id" } },
      installment_id: { type: DataTypes.UUID, references: { model: "hrms_loan_installments", key: "id" } },
      transaction_id: { type: DataTypes.STRING(64), allowNull: false },
      method: { type: DataTypes.ENUM("SALARY_DEDUCTION", "ONLINE", "ADJUSTMENT", "FNF_RECOVERY"), allowNull: false, defaultValue: "SALARY_DEDUCTION" },
      payslip_id: { type: DataTypes.UUID, references: { model: "hrms_payroll", key: "id" } },
      salary_transaction_id: { type: DataTypes.UUID, references: { model: "hrms_salary_transactions", key: "id" } },
      period_month: { type: DataTypes.TINYINT },
      period_year: { type: DataTypes.SMALLINT },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      status: { type: DataTypes.ENUM("INITIATED", "SUCCESS", "PARTIAL", "FAILED", "REVERSED"), allowNull: false, defaultValue: "SUCCESS" },
      gateway_reference: { type: DataTypes.STRING(100) },
      failure_reason: { type: DataTypes.STRING(255) },
      paid_at: { type: DataTypes.DATE },
      reversal_of_payment_id: { type: DataTypes.UUID, references: { model: "hrms_loan_payments", key: "id" } },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_loan_payments",
      underscored: true,
    }
  );

  LoanPayment.associate = (models) => {
    LoanPayment.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LoanPayment.belongsTo(models.Loan, { as: "loan", foreignKey: "loan_id" });
    LoanPayment.belongsTo(models.LoanInstallment, { as: "installment", foreignKey: "installment_id" });
    LoanPayment.belongsTo(models.Payroll, { as: "payslip", foreignKey: "payslip_id" });
    LoanPayment.belongsTo(models.SalaryTransaction, { as: "salaryTransaction", foreignKey: "salary_transaction_id" });
    LoanPayment.belongsTo(models.LoanPayment, { as: "reversalOfPayment", foreignKey: "reversal_of_payment_id" });
    LoanPayment.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    LoanPayment.hasMany(models.LoanPayment, { as: "loanPaymentsAsReversalOfPayment", foreignKey: "reversal_of_payment_id" });
    LoanPayment.hasMany(models.LoanLedger, { as: "loanLedgers", foreignKey: "payment_id" });
  };

  return LoanPayment;
};
