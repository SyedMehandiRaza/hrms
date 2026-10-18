"use strict";

module.exports = (sequelize, DataTypes) => {
  const DocumentType = sequelize.define(
    "DocumentType",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      category: { type: DataTypes.ENUM("LEGAL", "IDENTITY", "PROFESSIONAL", "SITE", "CONTRACT", "GENERAL"), allowNull: false },
      code: { type: DataTypes.STRING(100), allowNull: false },
      label: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.STRING(255) },
      requires_number: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      requires_expiry: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      requires_issuer: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_document_types",
      underscored: true,
    }
  );

  DocumentType.associate = (models) => {
    DocumentType.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    DocumentType.hasMany(models.EmployeeDocument, { as: "employeeDocuments", foreignKey: "document_type_id" });
  };

  return DocumentType;
};
