"use strict";

module.exports = (sequelize, DataTypes) => {
  const ContractTemplateField = sequelize.define(
    "ContractTemplateField",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      template_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_contract_templates", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
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
      assigned_role: { type: DataTypes.ENUM("PRIMARY_SIGNER", "APPROVER", "VIEWER", "WITNESS") },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      meta: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_contract_template_fields",
      underscored: true,
    }
  );

  ContractTemplateField.associate = (models) => {
    ContractTemplateField.belongsTo(models.ContractTemplate, { as: "template", foreignKey: "template_id" });
    ContractTemplateField.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ContractTemplateField.hasMany(models.ContractField, { as: "contractFields", foreignKey: "template_field_id" });
  };

  return ContractTemplateField;
};
