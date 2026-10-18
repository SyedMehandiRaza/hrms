"use strict";

module.exports = (sequelize, DataTypes) => {
  const LoanSkipRequest = sequelize.define(
    "LoanSkipRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      loan_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_loans", key: "id" } },
      installment_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_loan_installments", key: "id" } },
      new_installment_id: { type: DataTypes.UUID, references: { model: "hrms_loan_installments", key: "id" } },
      reason: { type: DataTypes.STRING(500) },
      status: { type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
      approver_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      decided_at: { type: DataTypes.DATE },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_loan_skip_requests",
      underscored: true,
    }
  );

  LoanSkipRequest.associate = (models) => {
    LoanSkipRequest.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LoanSkipRequest.belongsTo(models.Loan, { as: "loan", foreignKey: "loan_id" });
    LoanSkipRequest.belongsTo(models.LoanInstallment, { as: "installment", foreignKey: "installment_id" });
    LoanSkipRequest.belongsTo(models.LoanInstallment, { as: "newInstallment", foreignKey: "new_installment_id" });
    LoanSkipRequest.belongsTo(models.User, { as: "approver", foreignKey: "approver_id" });
    LoanSkipRequest.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    LoanSkipRequest.hasMany(models.LoanInstallment, { as: "loanInstallments", foreignKey: "generated_from_skip_id" });
  };

  return LoanSkipRequest;
};
