// Mirror of the backend MODULES (src/constants/permission.constants.js).
// Use these keys with the can(module, action) helper for UI show/hide.
export const MODULES = {
  ROLE: "role",
  MODULE: "module",
  EMPLOYEE: "employee",
  PROJECT: "project",
  OFFICE: "office",
  LEAVE: "leave",
  LEAVE_TYPE: "leave_type",
  LEAVE_POLICY: "leave_policy",
  LEAVE_APPROVAL: "leave_approval",
  APPROVAL_GROUP: "approval_group",
  SALARY: "salary",
  ATTENDANCE: "attendance",
  CORRECTION: "correction",
  PAYROLL: "payroll",
  LEAVE_CATEGORY: "leave_category",
  SHIFT: "shift",
  OFFICE_LOCATION: "office_location",
  NOTIFICATION: "notification",
  STAFFING_COMPANY: "staffing_company",
  HOLIDAY: "holiday",
  DOCUMENT: "document",
  DEPARTMENT: "department",
  DESIGNATION: "designation",
  CONTRACT: "contract",
  DASHBOARD: "dashboard",
  FINANCIAL_YEAR: "financial_year",
  EXIT: "exit",
};

// The /me/permissions response uses these action keys.
export const ACTIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
};