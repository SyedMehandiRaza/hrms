"use strict";

module.exports = (sequelize, DataTypes) => {
  const ApprovalGroup = sequelize.define(
    "ApprovalGroup",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      group_name: { type: DataTypes.STRING(150), allowNull: false },
      group_code: { type: DataTypes.STRING(100), allowNull: false },
      module_key: { type: DataTypes.STRING(100), allowNull: false },
      scope: { type: DataTypes.ENUM("GLOBAL", "PROJECT"), allowNull: false, defaultValue: "GLOBAL" },
      project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      description: { type: DataTypes.TEXT },
      total_levels: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_approval_groups",
      underscored: true,
      paranoid: true,
    }
  );

  ApprovalGroup.associate = (models) => {
    ApprovalGroup.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ApprovalGroup.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    ApprovalGroup.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    ApprovalGroup.hasMany(models.ApprovalGroupMember, { as: "approvalGroupMembers", foreignKey: "approval_group_id" });
    ApprovalGroup.hasMany(models.ApprovalAssignment, { as: "approvalAssignments", foreignKey: "approval_group_id" });
    ApprovalGroup.hasMany(models.EmployeeApprovalRouting, { as: "employeeApprovalRoutings", foreignKey: "approval_group_id" });
    ApprovalGroup.hasMany(models.ApprovalRequest, { as: "approvalRequests", foreignKey: "approval_group_id" });
  };

  return ApprovalGroup;
};
