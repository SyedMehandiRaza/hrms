"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeaveAttachment = sequelize.define(
    "LeaveAttachment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      leave_request_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_requests", key: "id" } },
      file_name: { type: DataTypes.STRING(255) },
      file_url: { type: DataTypes.TEXT },
      file_type: { type: DataTypes.STRING(100) },
      uploaded_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_leave_attachments",
      underscored: true,
      updatedAt: false,
    }
  );

  LeaveAttachment.associate = (models) => {
    LeaveAttachment.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LeaveAttachment.belongsTo(models.LeaveRequest, { as: "leaveRequest", foreignKey: "leave_request_id" });
    LeaveAttachment.belongsTo(models.User, { as: "uploadedBy", foreignKey: "uploaded_by" });
  };

  return LeaveAttachment;
};
