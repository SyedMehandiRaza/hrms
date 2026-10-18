"use strict";

module.exports = (sequelize, DataTypes) => {
  const ApprovalGroupMember = sequelize.define(
    "ApprovalGroupMember",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      approval_group_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_approval_groups", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      level_no: { type: DataTypes.INTEGER, allowNull: false },
      is_mandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      can_skip: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_approval_group_members",
      underscored: true,
    }
  );

  ApprovalGroupMember.associate = (models) => {
    ApprovalGroupMember.belongsTo(models.ApprovalGroup, { as: "approvalGroup", foreignKey: "approval_group_id" });
    ApprovalGroupMember.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    ApprovalGroupMember.hasMany(models.ApprovalRequestLog, { as: "approvalRequestLogs", foreignKey: "approval_group_member_id" });
  };

  return ApprovalGroupMember;
};
