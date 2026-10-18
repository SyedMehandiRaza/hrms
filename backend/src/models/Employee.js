"use strict";

module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define(
    "Employee",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "users", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_code: { type: DataTypes.STRING(30), allowNull: false },
      country_emp_id: { type: DataTypes.STRING(20), allowNull: false },
      full_name: { type: DataTypes.STRING(255), allowNull: false },
      nationality: { type: DataTypes.STRING(100) },
      dob: { type: DataTypes.DATEONLY },
      gender: { type: DataTypes.ENUM("MALE", "FEMALE", "OTHER") },
      address: { type: DataTypes.TEXT },
      accommodation: { type: DataTypes.STRING(255) },
      profile_url: { type: DataTypes.TEXT },
      employment_type: { type: DataTypes.ENUM("FULL_TIME", "CONTRACT") },
      employment_status: { type: DataTypes.ENUM("ACTIVE", "IN_NOTICE", "EXITED"), allowNull: false, defaultValue: "ACTIVE" },
      date_of_joining: { type: DataTypes.DATEONLY },
      exit_date: { type: DataTypes.DATEONLY },
      department_id: { type: DataTypes.UUID, references: { model: "hrms_departments", key: "id" } },
      designation_id: { type: DataTypes.UUID, references: { model: "hrms_designations", key: "id" } },
      shift_id: { type: DataTypes.UUID, references: { model: "company_shifts", key: "id" } },
      office_id: { type: DataTypes.UUID, references: { model: "offices", key: "id" } },
      staffing_company_id: { type: DataTypes.UUID, references: { model: "hrms_staffing_companies", key: "id" } },
      overtime_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 1.5 },
      is_billable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      signature_url: { type: DataTypes.STRING(512) },
      signature_type: { type: DataTypes.ENUM("DRAWN", "TYPED", "UPLOADED") },
      signature_updated_at: { type: DataTypes.DATE },
    },
    {
      tableName: "employees",
      underscored: true,
      paranoid: true,
    }
  );

  Employee.associate = (models) => {
    Employee.belongsTo(models.User, { as: "user", foreignKey: "user_id" });
    Employee.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Employee.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
    Employee.belongsTo(models.Designation, { as: "designation", foreignKey: "designation_id" });
    Employee.belongsTo(models.CompanyShift, { as: "shift", foreignKey: "shift_id" });
    Employee.belongsTo(models.Office, { as: "office", foreignKey: "office_id" });
    Employee.belongsTo(models.StaffingCompany, { as: "staffingCompany", foreignKey: "staffing_company_id" });
    Employee.hasMany(models.Department, { as: "departments", foreignKey: "dept_head_id" });
    Employee.hasMany(models.EmployeeProject, { as: "employeeProjects", foreignKey: "employee_id" });
    Employee.hasMany(models.EmployeeProjectHistory, { as: "employeeProjectHistories", foreignKey: "employee_id" });
    Employee.hasMany(models.EmployeeShiftHistory, { as: "employeeShiftHistories", foreignKey: "employee_id" });
    Employee.hasMany(models.EmployeeDependent, { as: "employeeDependents", foreignKey: "employee_id" });
    Employee.hasMany(models.EmployeeDocument, { as: "employeeDocuments", foreignKey: "employee_id" });
    Employee.hasMany(models.DocumentAuditLog, { as: "documentAuditLogs", foreignKey: "employee_id" });
    Employee.hasMany(models.EmployeeSalary, { as: "employeeSalaries", foreignKey: "employee_id" });
    Employee.hasMany(models.EmployeeLeavePolicy, { as: "employeeLeavePolicies", foreignKey: "employee_id" });
    Employee.hasMany(models.ApprovalGroupMember, { as: "approvalGroupMembers", foreignKey: "employee_id" });
    Employee.hasMany(models.EmployeeApprovalRouting, { as: "employeeApprovalRoutings", foreignKey: "employee_id" });
    Employee.hasMany(models.ApprovalRequest, { as: "approvalRequests", foreignKey: "requested_by" });
    Employee.hasMany(models.ApprovalRequestLog, { as: "approvalRequestLogs", foreignKey: "employee_id" });
    Employee.hasMany(models.Attendance, { as: "attendances", foreignKey: "employee_id" });
    Employee.hasMany(models.AttendanceCorrectionRequest, { as: "attendanceCorrectionRequests", foreignKey: "employee_id" });
    Employee.hasMany(models.OvertimeRequest, { as: "overtimeRequests", foreignKey: "employee_id" });
    Employee.hasMany(models.LeaveBalance, { as: "leaveBalances", foreignKey: "employee_id" });
    Employee.hasMany(models.LeaveRequest, { as: "leaveRequests", foreignKey: "employee_id" });
    Employee.hasMany(models.LeaveRequestDay, { as: "leaveRequestDays", foreignKey: "employee_id" });
    Employee.hasMany(models.LeaveBalanceTransaction, { as: "leaveBalanceTransactions", foreignKey: "employee_id" });
    Employee.hasMany(models.SalaryTransaction, { as: "salaryTransactions", foreignKey: "employee_id" });
    Employee.hasMany(models.LeaveEncashmentRequest, { as: "leaveEncashmentRequests", foreignKey: "employee_id" });
    Employee.hasMany(models.Payroll, { as: "payrolls", foreignKey: "employee_id" });
    Employee.hasMany(models.SalaryIncrementLine, { as: "salaryIncrementLines", foreignKey: "employee_id" });
    Employee.hasMany(models.Loan, { as: "loans", foreignKey: "employee_id" });
    Employee.belongsToMany(models.Project, { as: "projects", through: models.EmployeeProject, foreignKey: "employee_id", otherKey: "project_id" });
    Employee.belongsToMany(models.LeavePolicy, { as: "leavePolicies", through: models.EmployeeLeavePolicy, foreignKey: "employee_id", otherKey: "leave_policy_id" });
  };

  return Employee;
};
