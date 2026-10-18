"use strict";

module.exports = (sequelize, DataTypes) => {
  const ExitVisa = sequelize.define(
    "ExitVisa",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      visa_type: { type: DataTypes.ENUM("SINGLE_EXIT", "MULTIPLE_EXIT", "FINAL_EXIT"), allowNull: false },
      status: { type: DataTypes.ENUM("PENDING_APPROVAL", "APPROVED", "REJECTED", "ACTIVE", "EXHAUSTED", "EXPIRED", "CANCELLED"), allowNull: false, defaultValue: "PENDING_APPROVAL" },
      requested_from: { type: DataTypes.DATEONLY },
      requested_to: { type: DataTypes.DATEONLY },
      reason: { type: DataTypes.TEXT },
      visa_number: { type: DataTypes.STRING(100) },
      valid_from: { type: DataTypes.DATEONLY },
      valid_until: { type: DataTypes.DATEONLY },
      final_exit_date: { type: DataTypes.DATEONLY },
      max_exits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      exits_used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      document_id: { type: DataTypes.UUID, references: { model: "hrms_employee_documents", key: "id" } },
      applied_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      applied_at: { type: DataTypes.DATE },
      reviewed_at: { type: DataTypes.DATE },
      reject_reason: { type: DataTypes.TEXT },
    },
    {
      tableName: "hrms_exit_visas",
      underscored: true,
      paranoid: true,
    }
  );

  ExitVisa.associate = (models) => {
    ExitVisa.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ExitVisa.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    ExitVisa.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    ExitVisa.belongsTo(models.EmployeeDocument, { as: "document", foreignKey: "document_id" });
    ExitVisa.belongsTo(models.User, { as: "appliedBy", foreignKey: "applied_by" });
    ExitVisa.hasMany(models.ExitVisaTrip, { as: "exitVisaTrips", foreignKey: "exit_visa_id" });
  };

  return ExitVisa;
};
