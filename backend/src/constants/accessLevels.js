// Panel access levels stored on hrms_accounts.access_level (docs/backend-plan.md D2/P1).
const ACCESS_LEVELS = Object.freeze({
  ADMIN: "ADMIN",
  SUB_ADMIN: "SUB_ADMIN",
  EMPLOYEE: "EMPLOYEE",
  GENERAL_EMPLOYEE: "GENERAL_EMPLOYEE",
  STAFFING_COMPANY: "STAFFING_COMPANY",
});

const PANELS = Object.freeze({
  ADMIN: [ACCESS_LEVELS.ADMIN, ACCESS_LEVELS.SUB_ADMIN],
  EMPLOYEE: [ACCESS_LEVELS.EMPLOYEE, ACCESS_LEVELS.GENERAL_EMPLOYEE],
  STAFFING_COMPANY: [ACCESS_LEVELS.STAFFING_COMPANY],
});

// Panel name returned by GET /auth/me (D23); the UI routes to /<panel>/dashboard.
const PANEL_BY_ACCESS_LEVEL = Object.freeze({
  ADMIN: "admin",
  SUB_ADMIN: "admin",
  EMPLOYEE: "employee",
  GENERAL_EMPLOYEE: "employee",
  STAFFING_COMPANY: "staffing-company",
});

module.exports = { ACCESS_LEVELS, PANELS, PANEL_BY_ACCESS_LEVEL };
