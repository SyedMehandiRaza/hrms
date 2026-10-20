"use strict";

module.exports = (sequelize, DataTypes) => {
  const ApprovalRequestLog = sequelize.define(
    "ApprovalRequestLog",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      approval_request_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_approval_requests", key: "id" } },
      // Member and employee are empty on owner override and owner-only rows (workforce D27).
      approval_group_member_id: { type: DataTypes.UUID, references: { model: "hrms_approval_group_members", key: "id" } },
      employee_id: { type: DataTypes.UUID, references: { model: "employees", key: "id" } },
      actor_user_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      is_override: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      level_no: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED", "SKIPPED"), allowNull: false, defaultValue: "PENDING" },
      comments: { type: DataTypes.TEXT },
      acted_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_approval_request_logs",
      underscored: true,
      updatedAt: false,
    }
  );

  ApprovalRequestLog.associate = (models) => {
    ApprovalRequestLog.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    ApprovalRequestLog.belongsTo(models.ApprovalGroupMember, { as: "approvalGroupMember", foreignKey: "approval_group_member_id" });
    ApprovalRequestLog.belongsTo(models.User, { as: "actor", foreignKey: "actor_user_id" });
    ApprovalRequestLog.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
  };

  return ApprovalRequestLog;
};
