"use strict";

module.exports = (sequelize, DataTypes) => {
  const ApprovalRequest = sequelize.define(
    "ApprovalRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      approval_group_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_approval_groups", key: "id" } },
      module_key: { type: DataTypes.STRING(100), allowNull: false },
      entity_type: { type: DataTypes.STRING(100), allowNull: false },
      entity_id: { type: DataTypes.CHAR(36), allowNull: false },
      request_code: { type: DataTypes.STRING(100), allowNull: false },
      requested_by: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      current_level: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      total_levels: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      final_status: { type: DataTypes.ENUM("PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "CANCELLED"), allowNull: false, defaultValue: "PENDING" },
      remarks: { type: DataTypes.TEXT },
      requested_at: { type: DataTypes.DATE, allowNull: false },
      completed_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_approval_requests",
      underscored: true,
      paranoid: true,
    }
  );

  ApprovalRequest.associate = (models) => {
    ApprovalRequest.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ApprovalRequest.belongsTo(models.ApprovalGroup, { as: "approvalGroup", foreignKey: "approval_group_id" });
    ApprovalRequest.belongsTo(models.Employee, { as: "requestedBy", foreignKey: "requested_by" });
    ApprovalRequest.hasMany(models.ApprovalRequestLog, { as: "approvalRequestLogs", foreignKey: "approval_request_id" });
    ApprovalRequest.hasMany(models.AttendanceCorrectionRequest, { as: "attendanceCorrectionRequests", foreignKey: "approval_request_id" });
    ApprovalRequest.hasMany(models.OvertimeRequest, { as: "overtimeRequests", foreignKey: "approval_request_id" });
    ApprovalRequest.hasMany(models.LeaveRequest, { as: "leaveRequests", foreignKey: "approval_request_id" });
    ApprovalRequest.hasMany(models.LeaveEncashmentRequest, { as: "leaveEncashmentRequests", foreignKey: "approval_request_id" });
    ApprovalRequest.hasMany(models.PayrollRun, { as: "payrollRuns", foreignKey: "approval_request_id" });
    ApprovalRequest.hasMany(models.ExitVisa, { as: "exitVisas", foreignKey: "approval_request_id" });
  };

  return ApprovalRequest;
};
