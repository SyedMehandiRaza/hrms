"use strict";

module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define(
    "Project",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      office_id: { type: DataTypes.UUID, references: { model: "offices", key: "id" } },
      city_id: { type: DataTypes.UUID, references: { model: "cities", key: "id" } },
      project_name: { type: DataTypes.STRING(255), allowNull: false },
      project_code: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT },
      project_location: { type: DataTypes.STRING(255) },
      start_date: { type: DataTypes.DATEONLY },
      end_date: { type: DataTypes.DATEONLY },
      status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE", "COMPLETED", "ON_HOLD"), allowNull: false, defaultValue: "ACTIVE" },
      lat: { type: DataTypes.DECIMAL(10, 7) },
      lng: { type: DataTypes.DECIMAL(10, 7) },
      radius_meters: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
      allow_offline_attendance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      photo_url: { type: DataTypes.STRING(255) },
    },
    {
      tableName: "projects",
      underscored: true,
      paranoid: true,
    }
  );

  Project.associate = (models) => {
    Project.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Project.belongsTo(models.Office, { as: "office", foreignKey: "office_id" });
    Project.belongsTo(models.City, { as: "city", foreignKey: "city_id" });
    Project.hasMany(models.StaffingCompanyProject, { as: "staffingCompanyProjects", foreignKey: "project_id" });
    Project.hasMany(models.EmployeeProject, { as: "employeeProjects", foreignKey: "project_id" });
    Project.hasMany(models.EmployeeProjectHistory, { as: "employeeProjectHistoriesAsProject", foreignKey: "project_id" });
    Project.hasMany(models.EmployeeProjectHistory, { as: "employeeProjectHistoriesAsPreviousProject", foreignKey: "previous_project_id" });
    Project.hasMany(models.ApprovalGroup, { as: "approvalGroups", foreignKey: "project_id" });
    Project.hasMany(models.ApprovalAssignment, { as: "approvalAssignments", foreignKey: "project_id" });
    Project.hasMany(models.Attendance, { as: "attendances", foreignKey: "project_id" });
    Project.hasMany(models.OvertimeRequest, { as: "overtimeRequests", foreignKey: "project_id" });
    Project.hasMany(models.LeaveRequest, { as: "leaveRequests", foreignKey: "project_id" });
    Project.hasMany(models.SalaryTransaction, { as: "salaryTransactions", foreignKey: "project_id" });
    Project.hasMany(models.PayrollRun, { as: "payrollRuns", foreignKey: "project_id" });
    Project.hasMany(models.EmployeeExit, { as: "employeeExits", foreignKey: "settlement_scope_project_id" });
    Project.hasMany(models.StaffingBillItem, { as: "staffingBillItems", foreignKey: "project_id" });
    Project.belongsToMany(models.Employee, { as: "employees", through: models.EmployeeProject, foreignKey: "project_id", otherKey: "employee_id" });
    Project.belongsToMany(models.StaffingCompany, { as: "staffingCompanies", through: models.StaffingCompanyProject, foreignKey: "project_id", otherKey: "staffing_company_id" });
  };

  return Project;
};
