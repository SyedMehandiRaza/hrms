"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeExit = sequelize.define(
    "EmployeeExit",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      exit_type: { type: DataTypes.ENUM("RESIGNATION", "TERMINATION"), allowNull: false },
      reason_category: { type: DataTypes.STRING(40), allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      notice_start_date: { type: DataTypes.DATEONLY, allowNull: false },
      notice_days: { type: DataTypes.INTEGER, allowNull: false },
      preferred_last_day: { type: DataTypes.DATEONLY },
      original_last_working_day: { type: DataTypes.DATEONLY, allowNull: false },
      last_working_day: { type: DataTypes.DATEONLY, allowNull: false },
      allow_leave_during_notice: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      encash_leave: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      loan_handling: { type: DataTypes.ENUM("RECOVER", "WRITE_OFF", "SETTLED", "NONE"), allowNull: false, defaultValue: "NONE" },
      settlement_scope_project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      settlement_month: { type: DataTypes.TINYINT },
      settlement_year: { type: DataTypes.SMALLINT },
      settlement_snapshot: { type: DataTypes.JSON },
      rehire_eligible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      cooling_period_days: { type: DataTypes.INTEGER },
      rehire_allowed_from: { type: DataTypes.DATEONLY },
      status: {
        type: DataTypes.ENUM("PENDING_APPROVAL", "IN_NOTICE", "EXITED", "COMPLETED", "CANCELLED", "REJECTED"),
        allowNull: false,
        defaultValue: "PENDING_APPROVAL",
      },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      reject_reason: { type: DataTypes.STRING(500) },
      raised_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      exited_at: { type: DataTypes.DATE },
      completed_at: { type: DataTypes.DATE },
      cancelled_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      cancelled_at: { type: DataTypes.DATE },
      cancel_reason: { type: DataTypes.STRING(500) },
      confirmed_at: { type: DataTypes.DATE },
      confirmed_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      confirm_mode: { type: DataTypes.ENUM("ON_LWD", "IMMEDIATE") },
      confirm_override_reason: { type: DataTypes.STRING(500) },
      offline_clearance_key: { type: DataTypes.STRING(500) },
      offline_clearance_name: { type: DataTypes.STRING(255) },
      offline_clearance_mime: { type: DataTypes.STRING(100) },
      offline_clearance_size: { type: DataTypes.INTEGER },
      offline_clearance_uploaded_at: { type: DataTypes.DATE },
      offline_clearance_uploaded_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_employee_exits",
      underscored: true,
      paranoid: true,
    }
  );

  EmployeeExit.associate = (models) => {
    EmployeeExit.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeExit.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    EmployeeExit.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeExit.belongsTo(models.Project, { as: "settlementScopeProject", foreignKey: "settlement_scope_project_id" });
    EmployeeExit.belongsTo(models.User, { as: "raisedBy", foreignKey: "raised_by" });
    EmployeeExit.belongsTo(models.User, { as: "cancelledBy", foreignKey: "cancelled_by" });
    EmployeeExit.belongsTo(models.User, { as: "confirmedBy", foreignKey: "confirmed_by" });
    EmployeeExit.belongsTo(models.User, { as: "offlineClearanceUploadedBy", foreignKey: "offline_clearance_uploaded_by" });
    EmployeeExit.hasMany(models.ExitChecklistItem, { as: "exitChecklistItems", foreignKey: "exit_id" });
    EmployeeExit.hasMany(models.ExitDocument, { as: "exitDocuments", foreignKey: "exit_id" });
    EmployeeExit.hasMany(models.ExitEvent, { as: "exitEvents", foreignKey: "exit_id" });
  };

  return EmployeeExit;
};
