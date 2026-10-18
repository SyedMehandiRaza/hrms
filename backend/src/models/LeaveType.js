"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeaveType = sequelize.define(
    "LeaveType",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      leave_name: { type: DataTypes.STRING(150), allowNull: false },
      leave_code: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT },
      is_paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      allow_half_day: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      requires_document: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_leave_types",
      underscored: true,
    }
  );

  LeaveType.associate = (models) => {
    LeaveType.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LeaveType.hasMany(models.LeavePolicy, { as: "leavePolicies", foreignKey: "leave_type_id" });
    LeaveType.hasMany(models.LeaveBalance, { as: "leaveBalances", foreignKey: "leave_type_id" });
    LeaveType.hasMany(models.LeaveRequest, { as: "leaveRequests", foreignKey: "leave_type_id" });
    LeaveType.hasMany(models.LeaveBalanceTransaction, { as: "leaveBalanceTransactions", foreignKey: "leave_type_id" });
  };

  return LeaveType;
};
