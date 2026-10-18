"use strict";

module.exports = (sequelize, DataTypes) => {
  const OvertimeRequest = sequelize.define(
    "OvertimeRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      work_date: { type: DataTypes.DATEONLY, allowNull: false },
      start_time: { type: DataTypes.TIME },
      end_time: { type: DataTypes.TIME },
      overtime_hours: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
      reason: { type: DataTypes.TEXT },
      attachment_url: { type: DataTypes.TEXT },
      batch_id: { type: DataTypes.STRING(40) },
      status: { type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      reviewed_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      reviewed_at: { type: DataTypes.DATE },
      reject_reason: { type: DataTypes.TEXT },
    },
    {
      tableName: "hrms_overtime_requests",
      underscored: true,
    }
  );

  OvertimeRequest.associate = (models) => {
    OvertimeRequest.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    OvertimeRequest.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    OvertimeRequest.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    OvertimeRequest.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    OvertimeRequest.belongsTo(models.User, { as: "reviewedBy", foreignKey: "reviewed_by" });
  };

  return OvertimeRequest;
};
