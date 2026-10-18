"use strict";

module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define(
    "Attendance",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      project_id: { type: DataTypes.UUID, allowNull: false, references: { model: "projects", key: "id" } },
      work_date: { type: DataTypes.DATEONLY, allowNull: false },
      check_in_time: { type: DataTypes.DATE, allowNull: false },
      check_in_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      check_in_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      check_in_photo: { type: DataTypes.TEXT },
      check_out_time: { type: DataTypes.DATE },
      check_out_lat: { type: DataTypes.DECIMAL(10, 7) },
      check_out_lng: { type: DataTypes.DECIMAL(10, 7) },
      is_within_geofence: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      source: { type: DataTypes.ENUM("ONLINE", "OFFLINE"), allowNull: false, defaultValue: "ONLINE" },
      client_event_id: { type: DataTypes.STRING(100) },
      synced_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_attendance",
      underscored: true,
    }
  );

  Attendance.associate = (models) => {
    Attendance.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Attendance.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    Attendance.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    Attendance.hasMany(models.AttendanceCorrectionRequest, { as: "attendanceCorrectionRequests", foreignKey: "attendance_id" });
  };

  return Attendance;
};
