"use strict";

module.exports = (sequelize, DataTypes) => {
  const ContractField = sequelize.define(
    "ContractField",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      contract_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_contracts", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      recipient_id: { type: DataTypes.UUID, references: { model: "hrms_contract_recipients", key: "id" } },
      template_field_id: { type: DataTypes.UUID, references: { model: "hrms_contract_template_fields", key: "id" } },
      page_no: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      field_type: { type: DataTypes.ENUM("INPUT", "CHECKBOX", "SIGNATURE", "DB_COLUMN", "DATE", "INITIALS"), allowNull: false },
      label: { type: DataTypes.STRING(160) },
      field_key: { type: DataTypes.STRING(120) },
      checked_value: { type: DataTypes.STRING(160) },
      db_source: { type: DataTypes.ENUM("EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "COLLABORATING_COMPANY", "CONTRACT") },
      db_column: { type: DataTypes.STRING(120) },
      pos_x: { type: DataTypes.DECIMAL(6, 3), allowNull: false, defaultValue: 0 },
      pos_y: { type: DataTypes.DECIMAL(6, 3), allowNull: false, defaultValue: 0 },
      width: { type: DataTypes.DECIMAL(6, 3) },
      height: { type: DataTypes.DECIMAL(6, 3) },
      is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      value: { type: DataTypes.TEXT },
      filled_at: { type: DataTypes.DATE },
      meta: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_contract_fields",
      underscored: true,
    }
  );

  ContractField.associate = (models) => {
    ContractField.belongsTo(models.Contract, { as: "contract", foreignKey: "contract_id" });
    ContractField.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ContractField.belongsTo(models.ContractRecipient, { as: "recipient", foreignKey: "recipient_id" });
    ContractField.belongsTo(models.ContractTemplateField, { as: "templateField", foreignKey: "template_field_id" });
  };

  return ContractField;
};
