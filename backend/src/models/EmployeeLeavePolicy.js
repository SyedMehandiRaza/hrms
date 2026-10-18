"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeLeavePolicy = sequelize.define(
    "EmployeeLeavePolicy",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      leave_policy_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_policies", key: "id" } },
      effective_from: { type: DataTypes.DATEONLY },
      effective_to: { type: DataTypes.DATEONLY },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_employee_leave_policies",
      underscored: true,
    }
  );

  EmployeeLeavePolicy.associate = (models) => {
    EmployeeLeavePolicy.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeLeavePolicy.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeLeavePolicy.belongsTo(models.LeavePolicy, { as: "leavePolicy", foreignKey: "leave_policy_id" });
  };

  return EmployeeLeavePolicy;
};
