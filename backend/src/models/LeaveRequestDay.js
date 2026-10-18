"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeaveRequestDay = sequelize.define(
    "LeaveRequestDay",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      leave_request_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_requests", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      leave_date: { type: DataTypes.DATEONLY, allowNull: false },
      session_type: { type: DataTypes.ENUM("FULL_DAY", "FIRST_HALF", "SECOND_HALF"), allowNull: false, defaultValue: "FULL_DAY" },
      leave_value: { type: DataTypes.DECIMAL(3, 1), allowNull: false, defaultValue: 1 },
      is_weekly_off: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_holiday: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      holiday_id: { type: DataTypes.UUID, references: { model: "hrms_holidays", key: "id" } },
      holiday_name: { type: DataTypes.STRING(200) },
      is_sandwich_leave: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      is_counted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      leave_year: { type: DataTypes.SMALLINT },
    },
    {
      tableName: "hrms_leave_request_days",
      underscored: true,
      updatedAt: false,
    }
  );

  LeaveRequestDay.associate = (models) => {
    LeaveRequestDay.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LeaveRequestDay.belongsTo(models.LeaveRequest, { as: "leaveRequest", foreignKey: "leave_request_id" });
    LeaveRequestDay.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    LeaveRequestDay.belongsTo(models.Holiday, { as: "holiday", foreignKey: "holiday_id" });
  };

  return LeaveRequestDay;
};
