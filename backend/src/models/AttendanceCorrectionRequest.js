"use strict";

module.exports = (sequelize, DataTypes) => {
  const AttendanceCorrectionRequest = sequelize.define(
    "AttendanceCorrectionRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      attendance_id: { type: DataTypes.UUID, references: { model: "hrms_attendance", key: "id" } },
      work_date: { type: DataTypes.DATEONLY, allowNull: false },
      correction_type: { type: DataTypes.ENUM("ADD_CHECK_IN", "ADD_CHECK_OUT", "UPDATE_TIMES", "MARK_PRESENT"), allowNull: false },
      requested_check_in: { type: DataTypes.DATE },
      requested_check_out: { type: DataTypes.DATE },
      reason: { type: DataTypes.TEXT },
      attachment_url: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      reviewed_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      reviewed_at: { type: DataTypes.DATE },
      reject_reason: { type: DataTypes.TEXT },
    },
    {
      tableName: "hrms_attendance_correction_requests",
      underscored: true,
    }
  );

  AttendanceCorrectionRequest.associate = (models) => {
    AttendanceCorrectionRequest.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    AttendanceCorrectionRequest.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    AttendanceCorrectionRequest.belongsTo(models.Attendance, { as: "attendance", foreignKey: "attendance_id" });
    AttendanceCorrectionRequest.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    AttendanceCorrectionRequest.belongsTo(models.User, { as: "reviewedBy", foreignKey: "reviewed_by" });
  };

  return AttendanceCorrectionRequest;
};
