"use strict";

module.exports = (sequelize, DataTypes) => {
  const ApprovalAssignment = sequelize.define(
    "ApprovalAssignment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      module_key: { type: DataTypes.STRING(100), allowNull: false },
      approval_group_id: { type: DataTypes.UUID, references: { model: "hrms_approval_groups", key: "id" } },
      project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_approval_assignments",
      underscored: true,
    }
  );

  ApprovalAssignment.associate = (models) => {
    ApprovalAssignment.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ApprovalAssignment.belongsTo(models.ApprovalGroup, { as: "approvalGroup", foreignKey: "approval_group_id" });
    ApprovalAssignment.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
  };

  return ApprovalAssignment;
};
