"use strict";

module.exports = (sequelize, DataTypes) => {
  const Contract = sequelize.define(
    "Contract",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      contract_type_id: { type: DataTypes.UUID, references: { model: "hrms_contract_types", key: "id" } },
      template_id: { type: DataTypes.UUID, references: { model: "hrms_contract_templates", key: "id" } },
      document_id: { type: DataTypes.UUID, references: { model: "hrms_contract_documents", key: "id" } },
      project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      reference_no: { type: DataTypes.STRING(60) },
      name: { type: DataTypes.STRING(255), allowNull: false },
      audience_type: { type: DataTypes.ENUM("EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "COLLABORATING_COMPANY"), allowNull: false, defaultValue: "EMPLOYEE" },
      module_label: { type: DataTypes.STRING(80) },
      status: { type: DataTypes.ENUM("DRAFT", "SENT", "VIEWED", "SUBMITTED", "APPROVED", "REJECTED", "EXPIRED", "COMPLETED", "REVOKED"), allowNull: false, defaultValue: "DRAFT" },
      signing_order: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      page_count: { type: DataTypes.INTEGER },
      notes: { type: DataTypes.TEXT },
      sent_at: { type: DataTypes.DATE },
      viewed_at: { type: DataTypes.DATE },
      submitted_at: { type: DataTypes.DATE },
      approved_at: { type: DataTypes.DATE },
      completed_at: { type: DataTypes.DATE },
      expires_at: { type: DataTypes.DATE },
      start_date: { type: DataTypes.DATEONLY },
      end_date: { type: DataTypes.DATEONLY },
      renewal_due: { type: DataTypes.DATEONLY },
      approved_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      meta: { type: DataTypes.JSON },
      revoke_reason: { type: DataTypes.STRING(500) },
      revoked_at: { type: DataTypes.DATE },
      revoked_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      rate: { type: DataTypes.DECIMAL(12, 2) },
      rate_unit: { type: DataTypes.ENUM("HOURLY", "DAILY", "MONTHLY", "ANNUAL") },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "SAR" },
      notice_period_days: { type: DataTypes.INTEGER },
      // "E:<employee_id>" or "S:<staffing_company_id>", set at creation. The generated
      // active_key column built from it is never written, so it isn't declared here.
      recipient_key: { type: DataTypes.STRING(40) },
      values_sha256: { type: DataTypes.CHAR(64) },
      signed_pdf_path: { type: DataTypes.STRING(512) },
      signed_pdf_sha256: { type: DataTypes.CHAR(64) },
      reminder_sent_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_contracts",
      underscored: true,
      paranoid: true,
    }
  );

  Contract.associate = (models) => {
    Contract.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Contract.belongsTo(models.ContractType, { as: "contractType", foreignKey: "contract_type_id" });
    Contract.belongsTo(models.ContractTemplate, { as: "template", foreignKey: "template_id" });
    Contract.belongsTo(models.ContractDocument, { as: "document", foreignKey: "document_id" });
    Contract.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    Contract.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    Contract.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by" });
    Contract.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    Contract.belongsTo(models.User, { as: "revokedBy", foreignKey: "revoked_by" });
    Contract.hasMany(models.ContractRecipient, { as: "contractRecipients", foreignKey: "contract_id" });
    Contract.hasMany(models.ContractField, { as: "contractFields", foreignKey: "contract_id" });
    Contract.hasMany(models.ContractActivity, { as: "contractActivities", foreignKey: "contract_id" });
  };

  return Contract;
};
