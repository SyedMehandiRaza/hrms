"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeApprovalRouting = sequelize.define(
    "EmployeeApprovalRouting",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      module_key: { type: DataTypes.STRING(40), allowNull: false },
      approval_group_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_approval_groups", key: "id" } },
    },
    {
      tableName: "employee_approval_routing",
      underscored: true,
    }
  );

  EmployeeApprovalRouting.associate = (models) => {
    EmployeeApprovalRouting.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeApprovalRouting.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeApprovalRouting.belongsTo(models.ApprovalGroup, { as: "approvalGroup", foreignKey: "approval_group_id" });
  };

  return EmployeeApprovalRouting;
};
