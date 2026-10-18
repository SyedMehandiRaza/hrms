"use strict";

module.exports = (sequelize, DataTypes) => {
  const LoanAuditLog = sequelize.define(
    "LoanAuditLog",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      entity_type: { type: DataTypes.ENUM("LOAN", "INSTALLMENT", "SKIP_REQUEST", "PAYMENT"), allowNull: false },
      entity_id: { type: DataTypes.CHAR(36), allowNull: false },
      loan_id: { type: DataTypes.UUID, references: { model: "hrms_loans", key: "id" } },
      action: { type: DataTypes.STRING(50), allowNull: false },
      actor_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      old_values: { type: DataTypes.JSON },
      new_values: { type: DataTypes.JSON },
      remarks: { type: DataTypes.STRING(500) },
    },
    {
      tableName: "hrms_loan_audit_log",
      underscored: true,
      updatedAt: false,
    }
  );

  LoanAuditLog.associate = (models) => {
    LoanAuditLog.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LoanAuditLog.belongsTo(models.Loan, { as: "loan", foreignKey: "loan_id" });
    LoanAuditLog.belongsTo(models.User, { as: "actor", foreignKey: "actor_id" });
  };

  return LoanAuditLog;
};
