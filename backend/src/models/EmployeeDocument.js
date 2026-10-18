"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeDocument = sequelize.define(
    "EmployeeDocument",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      document_type_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_document_types", key: "id" } },
      document_number: { type: DataTypes.STRING(100) },
      issuing_authority: { type: DataTypes.STRING(150) },
      issue_date: { type: DataTypes.DATEONLY },
      expiry_date: { type: DataTypes.DATEONLY },
      file_url: { type: DataTypes.TEXT },
      file_name: { type: DataTypes.STRING(255) },
      file_type: { type: DataTypes.STRING(100) },
      status: { type: DataTypes.ENUM("DRAFT", "PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
      reject_reason: { type: DataTypes.TEXT },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      meta: { type: DataTypes.JSON },
      uploaded_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_employee_documents",
      underscored: true,
      paranoid: true,
    }
  );

  EmployeeDocument.associate = (models) => {
    EmployeeDocument.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeDocument.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeDocument.belongsTo(models.DocumentType, { as: "documentType", foreignKey: "document_type_id" });
    EmployeeDocument.belongsTo(models.User, { as: "uploadedBy", foreignKey: "uploaded_by" });
    EmployeeDocument.hasMany(models.DocumentAuditLog, { as: "documentAuditLogs", foreignKey: "document_id" });
    EmployeeDocument.hasMany(models.ExitVisa, { as: "exitVisas", foreignKey: "document_id" });
  };

  return EmployeeDocument;
};
