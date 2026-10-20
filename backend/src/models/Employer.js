"use strict";

const { COMPANY_COUNTRY_ID } = require("../utils/geoReference");

module.exports = (sequelize, DataTypes) => {
  const Employer = sequelize.define(
    "Employer",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "users", key: "id" } },
      industry_type_id: { type: DataTypes.UUID, references: { model: "industry_types", key: "id" } },
      company_name: { type: DataTypes.STRING(255), allowNull: false },
      company_logo: { type: DataTypes.TEXT },
      contact_person_name: { type: DataTypes.STRING(255) },
      company_email: { type: DataTypes.STRING(255) },
      company_phone_number: { type: DataTypes.STRING(30) },
      phone_country: { type: DataTypes.CHAR(2) },
      // Every company is in Saudi Arabia for now (countries-cities-phones D11).
      country_id: { type: DataTypes.UUID, allowNull: false, defaultValue: COMPANY_COUNTRY_ID, references: { model: "countries", key: "id" } },
      company_website: { type: DataTypes.STRING(255) },
      company_description: { type: DataTypes.TEXT },
      address: { type: DataTypes.TEXT },
      is_company_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      verification_requested: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      employer_status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE", "BANNED"), allowNull: false, defaultValue: "ACTIVE" },
      email_notification: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sms_notification: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "employers",
      underscored: true,
      paranoid: true,
    }
  );

  Employer.associate = (models) => {
    Employer.belongsTo(models.User, { as: "user", foreignKey: "user_id" });
    Employer.belongsTo(models.Country, { as: "country", foreignKey: "country_id" });
    Employer.belongsTo(models.IndustryType, { as: "industryType", foreignKey: "industry_type_id" });
    Employer.hasOne(models.CompanyTimeSetting, { as: "companyTimeSetting", foreignKey: "employer_id" });
    Employer.hasMany(models.FinancialYear, { as: "financialYears", foreignKey: "employer_id" });
    Employer.hasMany(models.NumberSequence, { as: "numberSequences", foreignKey: "employer_id" });
    Employer.hasMany(models.PeriodLock, { as: "periodLocks", foreignKey: "employer_id" });
    Employer.hasMany(models.Role, { as: "roles", foreignKey: "employer_id" });
    Employer.hasMany(models.HrmsAccount, { as: "hrmsAccounts", foreignKey: "employer_id" });
    Employer.hasMany(models.Notification, { as: "notifications", foreignKey: "employer_id" });
    Employer.hasMany(models.Department, { as: "departments", foreignKey: "employer_id" });
    Employer.hasMany(models.Designation, { as: "designations", foreignKey: "employer_id" });
    Employer.hasMany(models.Office, { as: "offices", foreignKey: "employer_id" });
    Employer.hasMany(models.Project, { as: "projects", foreignKey: "employer_id" });
    Employer.hasMany(models.CompanyShift, { as: "companyShifts", foreignKey: "employer_id" });
    Employer.hasMany(models.ShiftTimeHistory, { as: "shiftTimeHistories", foreignKey: "employer_id" });
    Employer.hasMany(models.ShiftWeekOff, { as: "shiftWeekOffs", foreignKey: "employer_id" });
    Employer.hasMany(models.Holiday, { as: "holidays", foreignKey: "employer_id" });
    Employer.hasMany(models.StaffingCompany, { as: "staffingCompanies", foreignKey: "employer_id" });
    Employer.hasMany(models.StaffingCompanyProject, { as: "staffingCompanyProjects", foreignKey: "employer_id" });
    Employer.hasMany(models.DocumentType, { as: "documentTypes", foreignKey: "employer_id" });
    Employer.hasMany(models.SalaryComponent, { as: "salaryComponents", foreignKey: "employer_id" });
    Employer.hasMany(models.LeaveType, { as: "leaveTypes", foreignKey: "employer_id" });
    Employer.hasMany(models.LeavePolicy, { as: "leavePolicies", foreignKey: "employer_id" });
    Employer.hasMany(models.Employee, { as: "employees", foreignKey: "employer_id" });
    Employer.hasMany(models.EmployeeProject, { as: "employeeProjects", foreignKey: "employer_id" });
    Employer.hasMany(models.EmployeeProjectHistory, { as: "employeeProjectHistories", foreignKey: "employer_id" });
    Employer.hasMany(models.EmployeeDraft, { as: "employeeDrafts", foreignKey: "employer_id" });
    Employer.hasMany(models.EmployeeDocument, { as: "employeeDocuments", foreignKey: "employer_id" });
    Employer.hasMany(models.DocumentAuditLog, { as: "documentAuditLogs", foreignKey: "employer_id" });
    Employer.hasMany(models.EmployeeSalary, { as: "employeeSalaries", foreignKey: "employer_id" });
    Employer.hasMany(models.EmployeeLeavePolicy, { as: "employeeLeavePolicies", foreignKey: "employer_id" });
    Employer.hasMany(models.ApprovalGroup, { as: "approvalGroups", foreignKey: "employer_id" });
    Employer.hasMany(models.ApprovalAssignment, { as: "approvalAssignments", foreignKey: "employer_id" });
    Employer.hasMany(models.EmployeeApprovalRouting, { as: "employeeApprovalRoutings", foreignKey: "employer_id" });
    Employer.hasMany(models.ApprovalRequest, { as: "approvalRequests", foreignKey: "employer_id" });
    Employer.hasMany(models.Attendance, { as: "attendances", foreignKey: "employer_id" });
    Employer.hasMany(models.AttendanceCorrectionRequest, { as: "attendanceCorrectionRequests", foreignKey: "employer_id" });
    Employer.hasMany(models.OvertimeRequest, { as: "overtimeRequests", foreignKey: "employer_id" });
    Employer.hasMany(models.LeaveBalance, { as: "leaveBalances", foreignKey: "employer_id" });
    Employer.hasMany(models.LeaveRequest, { as: "leaveRequests", foreignKey: "employer_id" });
    Employer.hasMany(models.LeaveRequestDay, { as: "leaveRequestDays", foreignKey: "employer_id" });
    Employer.hasMany(models.LeaveAttachment, { as: "leaveAttachments", foreignKey: "employer_id" });
    Employer.hasMany(models.LeaveBalanceTransaction, { as: "leaveBalanceTransactions", foreignKey: "employer_id" });
    Employer.hasMany(models.SalaryTransaction, { as: "salaryTransactions", foreignKey: "employer_id" });
    Employer.hasMany(models.LeaveEncashmentRequest, { as: "leaveEncashmentRequests", foreignKey: "employer_id" });
    Employer.hasMany(models.PayrollRun, { as: "payrollRuns", foreignKey: "employer_id" });
    Employer.hasMany(models.Payroll, { as: "payrolls", foreignKey: "employer_id" });
    Employer.hasMany(models.SalaryIncrementBatch, { as: "salaryIncrementBatches", foreignKey: "employer_id" });
    Employer.hasMany(models.Loan, { as: "loans", foreignKey: "employer_id" });
    Employer.hasMany(models.LoanInstallment, { as: "loanInstallments", foreignKey: "employer_id" });
    Employer.hasMany(models.LoanPayment, { as: "loanPayments", foreignKey: "employer_id" });
    Employer.hasMany(models.LoanSkipRequest, { as: "loanSkipRequests", foreignKey: "employer_id" });
    Employer.hasMany(models.LoanLedger, { as: "loanLedgers", foreignKey: "employer_id" });
    Employer.hasMany(models.LoanAuditLog, { as: "loanAuditLogs", foreignKey: "employer_id" });
    Employer.hasOne(models.ExitSetting, { as: "exitSetting", foreignKey: "employer_id" });
    Employer.hasMany(models.ExitChecklistTemplate, { as: "exitChecklistTemplates", foreignKey: "employer_id" });
    Employer.hasMany(models.EmployeeExit, { as: "employeeExits", foreignKey: "employer_id" });
    Employer.hasMany(models.ExitVisa, { as: "exitVisas", foreignKey: "employer_id" });
    Employer.hasMany(models.ExitVisaTrip, { as: "exitVisaTrips", foreignKey: "employer_id" });
    Employer.hasMany(models.StaffingRate, { as: "staffingRates", foreignKey: "employer_id" });
    Employer.hasMany(models.StaffingBill, { as: "staffingBills", foreignKey: "employer_id" });
    Employer.hasMany(models.StaffingBillItem, { as: "staffingBillItems", foreignKey: "employer_id" });
    Employer.hasMany(models.ContractType, { as: "contractTypes", foreignKey: "employer_id" });
    Employer.hasMany(models.ContractDocument, { as: "contractDocuments", foreignKey: "employer_id" });
    Employer.hasMany(models.ContractTemplate, { as: "contractTemplates", foreignKey: "employer_id" });
    Employer.hasMany(models.ContractTemplateField, { as: "contractTemplateFields", foreignKey: "employer_id" });
    Employer.hasMany(models.Contract, { as: "contracts", foreignKey: "employer_id" });
    Employer.hasMany(models.ContractRecipient, { as: "contractRecipientsAsEmployer", foreignKey: "employer_id" });
    Employer.hasMany(models.ContractRecipient, { as: "contractRecipientsAsPartnerEmployer", foreignKey: "partner_employer_id" });
    Employer.hasMany(models.ContractField, { as: "contractFields", foreignKey: "employer_id" });
    Employer.hasMany(models.ContractActivity, { as: "contractActivities", foreignKey: "employer_id" });
    Employer.hasMany(models.ProjectCollaborationRole, { as: "projectCollaborationRoles", foreignKey: "employer_id" });
    Employer.hasMany(models.ProjectInvitation, { as: "projectInvitationsAsInvitingEmployer", foreignKey: "inviting_employer_id" });
    Employer.hasMany(models.ProjectInvitation, { as: "projectInvitationsAsInvitedEmployer", foreignKey: "invited_employer_id" });
    Employer.hasMany(models.ProjectInvitation, { as: "projectInvitationsAsParentEmployer", foreignKey: "parent_employer_id" });
    Employer.hasMany(models.ProjectParticipant, { as: "projectParticipants", foreignKey: "employer_id" });
    Employer.hasMany(models.ProjectParticipantEdge, { as: "projectParticipantEdgesAsParentEmployer", foreignKey: "parent_employer_id" });
    Employer.hasMany(models.ProjectParticipantEdge, { as: "projectParticipantEdgesAsChildEmployer", foreignKey: "child_employer_id" });
    Employer.hasMany(models.ProjectVisibilityClosure, { as: "projectVisibilityClosuresAsAncestorEmployer", foreignKey: "ancestor_employer_id" });
    Employer.hasMany(models.ProjectVisibilityClosure, { as: "projectVisibilityClosuresAsDescendantEmployer", foreignKey: "descendant_employer_id" });
    Employer.hasMany(models.ProjectParticipantPermission, { as: "projectParticipantPermissionsAsEmployer", foreignKey: "employer_id" });
    Employer.hasMany(models.ProjectParticipantPermission, { as: "projectParticipantPermissionsAsGrantedByEmployer", foreignKey: "granted_by_employer_id" });
    Employer.hasMany(models.ProjectEmployeeDeployment, { as: "projectEmployeeDeployments", foreignKey: "partner_employer_id" });
  };

  return Employer;
};
