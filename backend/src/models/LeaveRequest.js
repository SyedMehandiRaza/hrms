"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeaveRequest = sequelize.define(
    "LeaveRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      leave_type_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" } },
      leave_policy_id: { type: DataTypes.UUID, references: { model: "hrms_leave_policies", key: "id" } },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      request_code: { type: DataTypes.STRING(100), allowNull: false },
      from_date: { type: DataTypes.DATEONLY, allowNull: false },
      to_date: { type: DataTypes.DATEONLY, allowNull: false },
      total_days: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
      paid_days: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      unpaid_days: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      reason: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED", "CANCELLED", "PARTIALLY_APPROVED"), allowNull: false, defaultValue: "PENDING" },
      applied_at: { type: DataTypes.DATE, allowNull: false },
      approved_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      approved_at: { type: DataTypes.DATE },
      rejected_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      rejected_at: { type: DataTypes.DATE },
      reject_reason: { type: DataTypes.TEXT },
      cancelled_at: { type: DataTypes.DATE },
      cancel_reason: { type: DataTypes.TEXT },
    },
    {
      tableName: "hrms_leave_requests",
      underscored: true,
      paranoid: true,
    }
  );

  LeaveRequest.associate = (models) => {
    LeaveRequest.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LeaveRequest.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    LeaveRequest.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    LeaveRequest.belongsTo(models.LeaveType, { as: "leaveType", foreignKey: "leave_type_id" });
    LeaveRequest.belongsTo(models.LeavePolicy, { as: "leavePolicy", foreignKey: "leave_policy_id" });
    LeaveRequest.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    LeaveRequest.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by" });
    LeaveRequest.belongsTo(models.User, { as: "rejectedBy", foreignKey: "rejected_by" });
    LeaveRequest.hasMany(models.LeaveRequestDay, { as: "leaveRequestDays", foreignKey: "leave_request_id" });
    LeaveRequest.hasMany(models.LeaveAttachment, { as: "leaveAttachments", foreignKey: "leave_request_id" });
  };

  return LeaveRequest;
};
