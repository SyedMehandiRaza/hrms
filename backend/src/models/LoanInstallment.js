"use strict";

module.exports = (sequelize, DataTypes) => {
  const LoanInstallment = sequelize.define(
    "LoanInstallment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      loan_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_loans", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      installment_no: { type: DataTypes.INTEGER, allowNull: false },
      due_date: { type: DataTypes.DATEONLY, allowNull: false },
      period_month: { type: DataTypes.TINYINT },
      period_year: { type: DataTypes.SMALLINT },
      emi_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      principal_component: { type: DataTypes.DECIMAL(12, 2) },
      interest_component: { type: DataTypes.DECIMAL(12, 2) },
      opening_balance: { type: DataTypes.DECIMAL(12, 2) },
      closing_balance: { type: DataTypes.DECIMAL(12, 2) },
      status: { type: DataTypes.ENUM("PENDING", "PAID", "PARTIALLY_PAID", "SKIPPED", "OVERDUE"), allowNull: false, defaultValue: "PENDING" },
      paid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      paid_date: { type: DataTypes.DATEONLY },
      schedule_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      generated_from_skip_id: { type: DataTypes.UUID, references: { model: "hrms_loan_skip_requests", key: "id" } },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "hrms_loan_installments",
      underscored: true,
    }
  );

  LoanInstallment.associate = (models) => {
    LoanInstallment.belongsTo(models.Loan, { as: "loan", foreignKey: "loan_id" });
    LoanInstallment.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LoanInstallment.belongsTo(models.LoanSkipRequest, { as: "generatedFromSkip", foreignKey: "generated_from_skip_id" });
    LoanInstallment.hasMany(models.LoanPayment, { as: "loanPayments", foreignKey: "installment_id" });
    LoanInstallment.hasMany(models.LoanSkipRequest, { as: "loanSkipRequestsAsInstallment", foreignKey: "installment_id" });
    LoanInstallment.hasMany(models.LoanSkipRequest, { as: "loanSkipRequestsAsNewInstallment", foreignKey: "new_installment_id" });
    LoanInstallment.hasMany(models.LoanLedger, { as: "loanLedgers", foreignKey: "installment_id" });
  };

  return LoanInstallment;
};
