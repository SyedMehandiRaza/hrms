"use strict";

module.exports = (sequelize, DataTypes) => {
  const ContractDocument = sequelize.define(
    "ContractDocument",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      name: { type: DataTypes.STRING(255), allowNull: false },
      original_file_name: { type: DataTypes.STRING(255) },
      file_path: { type: DataTypes.STRING(512) },
      file_url: { type: DataTypes.STRING(512) },
      file_type: { type: DataTypes.ENUM("PDF", "DOCX", "DOC"), allowNull: false, defaultValue: "PDF" },
      mime_type: { type: DataTypes.STRING(120) },
      file_size_bytes: { type: DataTypes.BIGINT },
      page_count: { type: DataTypes.INTEGER },
      status: { type: DataTypes.ENUM("SAVED", "ARCHIVED"), allowNull: false, defaultValue: "SAVED" },
      uploaded_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      meta: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_contract_documents",
      underscored: true,
      paranoid: true,
    }
  );

  ContractDocument.associate = (models) => {
    ContractDocument.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ContractDocument.belongsTo(models.User, { as: "uploadedBy", foreignKey: "uploaded_by" });
    ContractDocument.hasMany(models.ContractTemplate, { as: "contractTemplates", foreignKey: "document_id" });
    ContractDocument.hasMany(models.Contract, { as: "contracts", foreignKey: "document_id" });
  };

  return ContractDocument;
};
