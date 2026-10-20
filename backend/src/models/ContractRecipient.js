"use strict";

module.exports = (sequelize, DataTypes) => {
  const ContractRecipient = sequelize.define(
    "ContractRecipient",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      contract_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_contracts", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      recipient_type: { type: DataTypes.ENUM("EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "EXTERNAL", "COLLABORATING_COMPANY"), allowNull: false },
      employee_id: { type: DataTypes.UUID, references: { model: "employees", key: "id" } },
      staffing_company_id: { type: DataTypes.UUID, references: { model: "hrms_staffing_companies", key: "id" } },
      partner_employer_id: { type: DataTypes.UUID, references: { model: "employers", key: "id" } },
      recipient_name: { type: DataTypes.STRING(160) },
      recipient_email: { type: DataTypes.STRING(160) },
      recipient_phone: { type: DataTypes.STRING(40) },
      role: { type: DataTypes.ENUM("PRIMARY_SIGNER", "APPROVER", "VIEWER", "WITNESS"), allowNull: false, defaultValue: "PRIMARY_SIGNER" },
      signing_sequence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: DataTypes.ENUM("PENDING", "SENT", "VIEWED", "SIGNED", "SUBMITTED", "DECLINED"), allowNull: false, defaultValue: "PENDING" },
      access_token_hash: { type: DataTypes.STRING(128) },
      color_index: { type: DataTypes.INTEGER },
      sent_at: { type: DataTypes.DATE },
      viewed_at: { type: DataTypes.DATE },
      signed_at: { type: DataTypes.DATE },
      submitted_at: { type: DataTypes.DATE },
      reject_reason: { type: DataTypes.STRING(500) },
      signed_ip: { type: DataTypes.STRING(64) },
      signed_user_agent: { type: DataTypes.STRING(255) },
      evidence: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_contract_recipients",
      underscored: true,
    }
  );

  ContractRecipient.associate = (models) => {
    ContractRecipient.belongsTo(models.Contract, { as: "contract", foreignKey: "contract_id" });
    ContractRecipient.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ContractRecipient.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    ContractRecipient.belongsTo(models.StaffingCompany, { as: "staffingCompany", foreignKey: "staffing_company_id" });
    ContractRecipient.belongsTo(models.Employer, { as: "partnerEmployer", foreignKey: "partner_employer_id" });
    ContractRecipient.hasMany(models.ContractField, { as: "contractFields", foreignKey: "recipient_id" });
    ContractRecipient.hasMany(models.ContractActivity, { as: "contractActivities", foreignKey: "recipient_id" });
  };

  return ContractRecipient;
};
