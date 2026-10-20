"use strict";

module.exports = (sequelize, DataTypes) => {
  const ContractTemplate = sequelize.define(
    "ContractTemplate",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      document_id: { type: DataTypes.UUID, references: { model: "hrms_contract_documents", key: "id" } },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT },
      audience_type: { type: DataTypes.ENUM("EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "COLLABORATING_COMPANY"), allowNull: false, defaultValue: "EMPLOYEE" },
      page_count: { type: DataTypes.INTEGER },
      status: { type: DataTypes.ENUM("DRAFT", "ACTIVE", "ARCHIVED"), allowNull: false, defaultValue: "ACTIVE" },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      meta: { type: DataTypes.JSON },
      contract_type_id: { type: DataTypes.UUID, references: { model: "hrms_contract_types", key: "id" } },
    },
    {
      tableName: "hrms_contract_templates",
      underscored: true,
      paranoid: true,
    }
  );

  ContractTemplate.associate = (models) => {
    ContractTemplate.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ContractTemplate.belongsTo(models.ContractDocument, { as: "document", foreignKey: "document_id" });
    ContractTemplate.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    ContractTemplate.belongsTo(models.ContractType, { as: "contractType", foreignKey: "contract_type_id" });
    ContractTemplate.hasMany(models.ContractTemplateField, { as: "contractTemplateFields", foreignKey: "template_id" });
    ContractTemplate.hasMany(models.Contract, { as: "contracts", foreignKey: "template_id" });
  };

  return ContractTemplate;
};
