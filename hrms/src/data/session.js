// The signed-in user in the shape the screens already use, built from the real
// session (/auth/me, see data/sessionStore.js). The static profiles below only
// fill fields the API does not have yet (employee_id etc., until the Employees
// module) and stand in when nobody is logged in. The financial-year store is
// still static.
import { sessionStore } from "./sessionStore";
import { assetUrl } from "../api/client";

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

const LAYOUT_BY_PANEL = {
  admin: "ADMIN",
  employee: "EMPLOYEE",
  "staffing-company": "STAFFING_COMPANY",
};

// /auth/me data → the legacy user shape (null when logged out).
export const toCurrentUser = (me) => {
  if (!me) return null;
  const layoutRole = LAYOUT_BY_PANEL[me.account?.panel] || "ADMIN";
  const placeholder = STATIC_USERS[layoutRole];
  const [first_name = "", ...rest] = (me.user?.name || "").trim().split(/\s+/);
  return {
    // Not in /auth/me yet — kept so the still-static screens keep working.
    employee_id: placeholder.employee_id,
    staffing_company_id: placeholder.staffing_company_id,
    id: me.user?.id,
    accountId: me.account?.id,
    companyId: me.company?.id,
    name: me.user?.name || "",
    first_name,
    last_name: rest.join(" "),
    email: me.user?.email || "",
    lang: me.user?.lang_key || null,
    role: me.account?.access_level || "",
    accessLevel: me.account?.access_level || "",
    panel: me.account?.panel || null,
    layoutRole,
    company_name: me.company?.name || "",
    company_logo: assetUrl(me.company?.logo),
    company: me.company || null,
    profile_image: null,
  };
};

// The signed-in user (non-hook; components should prefer useCurrentUser()).
// Logged out: the static profile of the URL's panel, so nothing crashes.
export const getStaticUser = () => {
  const real = toCurrentUser(sessionStore.getState().me);
  if (real) return real;
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (path.startsWith("/employee")) return STATIC_USERS.EMPLOYEE;
  if (path.startsWith("/staffing-company")) return STATIC_USERS.STAFFING_COMPANY;
  return STATIC_USERS.ADMIN;
};

export const homeFor = (layoutRole) => HOME[layoutRole] || HOME.ADMIN;

// isSuper = the company owner (access level ADMIN bypasses role checks).
// approvalModules stays static until approval groups are wired.
export const STATIC_PERMISSION = {
  get isSuper() {
    return sessionStore.getState().me?.account?.access_level === "ADMIN";
  },
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
