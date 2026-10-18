"use strict";

module.exports = (sequelize, DataTypes) => {
  const DocumentAuditLog = sequelize.define(
    "DocumentAuditLog",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      document_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_employee_documents", key: "id" } },
      employee_id: { type: DataTypes.UUID, references: { model: "employees", key: "id" } },
      action: { type: DataTypes.ENUM("UPLOAD", "VIEW", "DOWNLOAD", "UPDATE", "DELETE", "RESTORE", "CONTRACT_APPROVE", "CONTRACT_REJECT"), allowNull: false },
      actor_user_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      note: { type: DataTypes.TEXT },
      ip: { type: DataTypes.STRING(64) },
      meta: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_document_audit_logs",
      underscored: true,
      updatedAt: false,
    }
  );

  DocumentAuditLog.associate = (models) => {
    DocumentAuditLog.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    DocumentAuditLog.belongsTo(models.EmployeeDocument, { as: "document", foreignKey: "document_id" });
    DocumentAuditLog.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    DocumentAuditLog.belongsTo(models.User, { as: "actorUser", foreignKey: "actor_user_id" });
  };

  return DocumentAuditLog;
};
