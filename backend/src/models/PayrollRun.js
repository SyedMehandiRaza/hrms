"use strict";

module.exports = (sequelize, DataTypes) => {
  const PayrollRun = sequelize.define(
    "PayrollRun",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      reference_no: { type: DataTypes.STRING(30), allowNull: false },
      period_month: { type: DataTypes.TINYINT, allowNull: false },
      period_year: { type: DataTypes.SMALLINT, allowNull: false },
      period_start: { type: DataTypes.DATEONLY, allowNull: false },
      period_end: { type: DataTypes.DATEONLY, allowNull: false },
      status: { type: DataTypes.ENUM("DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PAID", "CREDITED"), allowNull: false, defaultValue: "DRAFT" },
      reject_reason: { type: DataTypes.TEXT },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      total_net: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      generated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      generated_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_payroll_runs",
      underscored: true,
      paranoid: true,
    }
  );

  PayrollRun.associate = (models) => {
    PayrollRun.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    PayrollRun.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    PayrollRun.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    PayrollRun.belongsTo(models.User, { as: "generatedBy", foreignKey: "generated_by" });
    PayrollRun.hasMany(models.Payroll, { as: "payrolls", foreignKey: "run_id" });
  };

  return PayrollRun;
};
