// Static session for the UI-only build — stands in for login, permissions and
// the financial-year store. Nothing here talks to a backend.

export const STATIC_USERS = {
  ADMIN: {
    id: 1,
    companyId: 1,
    name: "Ahmed Al Mansoori",
    first_name: "Ahmed",
    last_name: "Al Mansoori",
    email: "ahmed@fyinder.com",
    role: "OWNER",
    layoutRole: "ADMIN",
    company_name: "Fyinder Technologies LLC",
    profile_image: null,
  },
  EMPLOYEE: {
    id: 2,
    companyId: 1,
    employee_id: 4,
    name: "Sara Khan",
    first_name: "Sara",
    last_name: "Khan",
    email: "sara.khan@fyinder.com",
    role: "EMPLOYEE",
    layoutRole: "EMPLOYEE",
    company_name: "Fyinder Technologies LLC",
    profile_image: null,
  },
  STAFFING_COMPANY: {
    id: 3,
    companyId: 1,
    staffing_company_id: 1,
    name: "Gulf Manpower Services",
    email: "ops@gulfmanpower.ae",
    role: "STAFFING_COMPANY",
    layoutRole: "STAFFING_COMPANY",
    company_name: "Gulf Manpower Services",
    profile_image: null,
  },
};

const HOME = {
  ADMIN: "/admin/dashboard",
  EMPLOYEE: "/employee/dashboard",
  STAFFING_COMPANY: "/staffing-company/dashboard",
};

// The role is picked from the URL section, so every panel is reachable directly.
export const getStaticUser = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (path.startsWith("/employee")) return STATIC_USERS.EMPLOYEE;
  if (path.startsWith("/staffing-company")) return STATIC_USERS.STAFFING_COMPANY;
  return STATIC_USERS.ADMIN;
};

export const homeFor = (layoutRole) => HOME[layoutRole] || HOME.ADMIN;

// Everything is allowed in the static build.
export const STATIC_PERMISSION = {
  isSuper: true,
  modules: {},
  approvalModules: ["LEAVE", "OVERTIME", "ATTENDANCE", "LOAN", "EXIT"],
};

export const STATIC_FISCAL_YEAR = {
  startMonth: 1,
  timezone: "Asia/Dubai",
  me: null,
  years: [
    { id: 1, year_key: 2025, label: "FY 2025", start_date: "2025-01-01", end_date: "2025-12-31", status: "CLOSED", is_locked: false },
    { id: 2, year_key: 2026, label: "FY 2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "OPEN", is_locked: false },
  ],
  current: { id: 2, year_key: 2026, label: "FY 2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "OPEN", is_locked: false },
  selected: 2026,
};
