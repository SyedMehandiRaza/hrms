"use strict";

module.exports = (sequelize, DataTypes) => {
  const LoanLedger = sequelize.define(
    "LoanLedger",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      loan_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_loans", key: "id" } },
      entry_type: { type: DataTypes.ENUM("DISBURSEMENT", "PAYMENT", "PENALTY", "WAIVER", "SKIP_DEFERRAL", "FORECLOSURE_SETTLEMENT", "FNF_RECOVERY", "REVERSAL"), allowNull: false },
      direction: { type: DataTypes.ENUM("DEBIT", "CREDIT"), allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      installment_id: { type: DataTypes.UUID, references: { model: "hrms_loan_installments", key: "id" } },
      payment_id: { type: DataTypes.UUID, references: { model: "hrms_loan_payments", key: "id" } },
      balance_after: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      entry_date: { type: DataTypes.DATEONLY, allowNull: false },
      remarks: { type: DataTypes.STRING(255) },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_loan_ledger",
      underscored: true,
      updatedAt: false,
    }
  );

  LoanLedger.associate = (models) => {
    LoanLedger.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LoanLedger.belongsTo(models.Loan, { as: "loan", foreignKey: "loan_id" });
    LoanLedger.belongsTo(models.LoanInstallment, { as: "installment", foreignKey: "installment_id" });
    LoanLedger.belongsTo(models.LoanPayment, { as: "payment", foreignKey: "payment_id" });
    LoanLedger.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
  };

  return LoanLedger;
};
