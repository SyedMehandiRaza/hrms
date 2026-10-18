// Static data for group A (app shell, auth, settings, dashboard) of the
// UI-only build. Built on the shared entities in common.js.
import { EMPLOYEES, PROJECTS, nextId } from "./common";

export { nextId };

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const daysFromToday = (d) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

// ── Sidebar ──────────────────────────────────────────────────────────────────
export const INVITATION_COUNTS = { received: 2, approvals: 1 };

// ── Header project picker ────────────────────────────────────────────────────
export const HEADER_PROJECTS = PROJECTS.map((p) => ({
  id: p.id,
  project_name: p.name,
  project_code: p.code,
  status: p.status,
}));

// ── Notifications (bell + panel) ─────────────────────────────────────────────
export const NOTIFICATIONS = [
  { id: 1, title: "Leave request submitted", message: "Rahul Menon applied for Annual Leave (3 days, 21–23 Oct).", is_read: false, created_at: minutesAgo(12), meta_data: { module: "LEAVE" } },
  { id: 2, title: "Overtime awaiting approval", message: "Khalid Al Otaibi logged 4h overtime on Riyadh Metro Maintenance.", is_read: false, created_at: minutesAgo(95), meta_data: { module: "OVERTIME" } },
  { id: 3, title: "Attendance correction", message: "Maria Santos requested a check-in correction for yesterday.", is_read: false, created_at: minutesAgo(60 * 26), meta_data: { module: "CORRECTION" } },
  { id: 4, title: "Payroll run submitted", message: "September 2026 payroll (AED 412,580) is ready for review.", is_read: true, created_at: minutesAgo(60 * 30), meta_data: { module: "PAYROLL" } },
  { id: 5, title: "Loan request", message: "Imran Sheikh requested a salary advance of AED 3,000.", is_read: true, created_at: minutesAgo(60 * 24 * 3), meta_data: { module: "LOAN" } },
  { id: 6, title: "Visa expiring soon", message: "Joseph Mathew's residence visa expires in 21 days.", is_read: true, created_at: minutesAgo(60 * 24 * 5), meta_data: { module: "DOCUMENT" } },
];

// Tiny local store so the header badge and the panel stay in sync.
let notifState = {
  list: NOTIFICATIONS,
  unreadCount: NOTIFICATIONS.filter((n) => !n.is_read).length,
  loading: false,
};
const notifListeners = new Set();
const setNotifList = (list) => {
  notifState = { list, unreadCount: list.filter((n) => !n.is_read).length, loading: false };
  notifListeners.forEach((fn) => fn());
};
export const notificationStore = {
  get: () => notifState,
  subscribe: (fn) => {
    notifListeners.add(fn);
    return () => notifListeners.delete(fn);
  },
  markRead: (id) => setNotifList(notifState.list.map((n) => (n.id === id ? { ...n, is_read: true } : n))),
  markAllRead: () => setNotifList(notifState.list.map((n) => ({ ...n, is_read: true }))),
};

// ── Invite landing (/invite/:token) ──────────────────────────────────────────
export const INVITE_INFO = {
  invitingCompany: { id: 1, name: "Fyinder Technologies LLC" },
  role: "SUBCONTRACTOR",
  parentCompany: { id: 7, name: "Al Futtaim Engineering" },
  projects: [
    { id: 1, name: "Marina Tower Fit-out" },
    { id: 2, name: "Yas Mall Expansion" },
  ],
  invitedEmail: "projects@desertbuild.ae",
};

// ── My annual statements (employee) ──────────────────────────────────────────
export const MY_ANNUAL_STATEMENTS = [
  { id: 11, year_key: 2025, label: "FY 2025", generated_at: "2026-01-06T09:30:00Z", version: 2, pdf_download_url: "#", csv_download_url: "#" },
  { id: 7, year_key: 2024, label: "FY 2024", generated_at: "2025-01-08T08:10:00Z", version: 1, pdf_download_url: "#", csv_download_url: null },
];

// ── Company profile (Settings → Company) ─────────────────────────────────────
export const INDUSTRIES = [
  { id: 1, name: "Construction & Engineering" },
  { id: 2, name: "Facilities Management" },
  { id: 3, name: "Information Technology" },
  { id: 4, name: "Oil & Gas" },
  { id: 5, name: "Hospitality" },
  { id: 6, name: "Logistics & Transport" },
];

export const COMPANY_PROFILE = {
  id: 1042,
  company_name: "Fyinder Technologies LLC",
  phone_number: "+971 4 555 0192",
  email: "hr@fyinder.com",
  address: "Office 1204, Bay Square Building 5, Business Bay, Dubai, UAE",
  industry_type_id: 1,
  created_at: "2024-03-18T07:45:00Z",
  profile_url: null,
};

// ── Roles & permissions (Settings → Roles) ───────────────────────────────────
export const RBAC_MODULES = [
  "employee", "attendance", "correction", "leave", "leave_type", "leave_policy",
  "leave_category", "leave_approval", "approval_group", "holiday", "shift",
  "payroll", "salary", "project", "office", "office_location", "staffing_company",
  "notification", "role", "module",
].map((module, i) => ({ id: i + 1, module }));

const grant = (moduleNames, flags) =>
  RBAC_MODULES.filter((m) => moduleNames.includes(m.module)).map((m) => ({
    module_id: m.id,
    module: m.module,
    can_read: !!flags.r,
    can_create: !!flags.c,
    can_update: !!flags.u,
    can_delete: !!flags.d,
  }));

export const RBAC_ROLES = [
  {
    id: 1,
    name: "HR Manager",
    description: "Full access to people, leave, attendance and payroll.",
    permissions: grant(RBAC_MODULES.map((m) => m.module), { r: 1, c: 1, u: 1, d: 1 }),
  },
  {
    id: 2,
    name: "Payroll Officer",
    description: "Runs monthly payroll and manages salary structures.",
    permissions: [
      ...grant(["payroll", "salary"], { r: 1, c: 1, u: 1 }),
      ...grant(["employee", "attendance"], { r: 1 }),
    ],
  },
  {
    id: 3,
    name: "Site Supervisor",
    description: "Tracks attendance and overtime on project sites.",
    permissions: [
      ...grant(["attendance", "correction", "shift"], { r: 1, c: 1, u: 1 }),
      ...grant(["employee", "project"], { r: 1 }),
    ],
  },
  {
    id: 4,
    name: "Line Manager",
    description: "Approves leave for direct reports.",
    permissions: grant(["leave", "leave_approval", "employee"], { r: 1, u: 1 }),
  },
  { id: 5, name: "Auditor", description: "", permissions: grant(["payroll", "employee", "attendance", "leave"], { r: 1 }) },
];

// ── User management (Settings → Users) ───────────────────────────────────────
// Employees that hold a non-basic role (the screen hides plain employees).
const USER_ROLES = { 1: "Admin", 2: "HR Manager", 3: "Manager", 5: "Payroll Officer", 7: "Site Supervisor", 8: "Manager", 11: "Payroll Officer", 12: "Site Supervisor" };
export const MANAGED_USERS = EMPLOYEES.filter((e) => USER_ROLES[e.id]).map((e) => ({
  id: e.id,
  full_name: e.full_name,
  email: e.email,
  country_emp_id: e.employee_code,
  profile_url: null,
  user_status: e.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
  roles: [{ id: e.id, name: USER_ROLES[e.id] }],
}));

// ── Holiday copy (year → year) preview ───────────────────────────────────────
const fyBounds = (yearKey) => ({ from: `${yearKey}-01-01`, to: `${yearKey}-12-31` });
const fyYearLabel = (yearKey) => `FY ${yearKey}`;
const shiftYear = (date, diff) => `${Number(date.slice(0, 4)) + diff}${date.slice(4)}`;

const SOURCE_HOLIDAYS = [
  { source_id: 101, holiday_name: "New Year's Day", holiday_type: "PUBLIC", md: "01-01", city_id: null, flags: [] },
  { source_id: 102, holiday_name: "Eid al-Fitr", holiday_type: "FESTIVAL", md: "03-30", city_id: null, flags: ["CHECK_DATE"] },
  { source_id: 103, holiday_name: "Arafat Day", holiday_type: "FESTIVAL", md: "06-05", city_id: null, flags: ["CHECK_DATE"] },
  { source_id: 104, holiday_name: "Eid al-Adha", holiday_type: "FESTIVAL", md: "06-06", city_id: null, flags: ["CHECK_DATE", "CONFLICT"] },
  { source_id: 105, holiday_name: "Commemoration Day", holiday_type: "NATIONAL", md: "12-01", city_id: 1, flags: [] },
  { source_id: 106, holiday_name: "UAE National Day", holiday_type: "NATIONAL", md: "12-02", city_id: 1, flags: [] },
  { source_id: 107, holiday_name: "Company Foundation Day", holiday_type: "COMPANY", md: "09-15", city_id: null, flags: ["ALREADY_COPIED"] },
  { source_id: 108, holiday_name: "Saudi Founding Day", holiday_type: "OPTIONAL", md: "02-22", city_id: 4, flags: [] },
];

export const holidayCopyPreview = (fromFy, toFy) => {
  const diff = Number(toFy) - Number(fromFy);
  return {
    from: { year_key: Number(fromFy), label: fyYearLabel(fromFy), ...fyBounds(fromFy) },
    to: { year_key: Number(toFy), label: fyYearLabel(toFy), ...fyBounds(toFy), is_locked: false },
    items: SOURCE_HOLIDAYS.map(({ md, ...h }) => {
      const source_date = `${fromFy}-${md}`;
      return {
        ...h,
        source_date,
        proposed_date: shiftYear(source_date, diff),
        include_default: h.flags.length === 0,
      };
    }),
  };
};

// ── Week-off copy (previous FY → toFy) preview ───────────────────────────────
export const weekOffCopyPreview = (toFy) => {
  const to = Number(toFy);
  const from = to - 1;
  return {
    from_fy: from,
    source_range: fyBounds(from),
    target_range: fyBounds(to),
    shifts: [
      { shift_id: 1, name: "General Shift (09:00–18:00)", pattern: [5, 6], dates_to_add: 84, already_present: 20, skipped_locked: 0, skipped_past: 0 },
      { shift_id: 2, name: "Site Morning (06:00–15:00)", pattern: [5], dates_to_add: 38, already_present: 0, skipped_locked: 4, skipped_past: 10 },
      { shift_id: 3, name: "Riyadh Office (08:00–17:00)", pattern: [5, 6], dates_to_add: 0, already_present: 104, skipped_locked: 0, skipped_past: 0 },
      { shift_id: 4, name: "Night Shift (22:00–07:00)", pattern: [0], dates_to_add: 52, already_present: 0, skipped_locked: 0, skipped_past: 0 },
    ],
    irregular: [
      { shift_id: 5, name: "Rotational Crew A", reason: "No regular weekly pattern found in the previous financial year" },
      { shift_id: 6, name: "Ramadan Hours", reason: "No off-days in the previous financial year" },
    ],
  };
};

// ── Annual reports (year documents) ──────────────────────────────────────────
const STAFFING = [
  { id: 1, name: "Gulf Manpower Services" },
  { id: 2, name: "Al Noor Staffing LLC" },
];
let docSeq = 0;
const yearDoc = (year_key, doc_type, extra = {}) => {
  docSeq += 1;
  return {
    id: docSeq,
    year_key,
    doc_type,
    employee_id: null,
    employee: null,
    staffing_company_id: null,
    staffing_company: null,
    version: 1,
    generated_at: `${year_key + 1}-01-0${(docSeq % 8) + 1}T08:${String(10 + (docSeq % 40)).padStart(2, "0")}:00Z`,
    sent_at: null,
    pdf_url: "#",
    pdf_download_url: "#",
    csv_download_url: doc_type === "ANNUAL_PAY_STATEMENT" ? null : "#",
    ...extra,
  };
};
const empDoc = (year_key, e, extra) =>
  yearDoc(year_key, "ANNUAL_PAY_STATEMENT", { employee_id: e.id, employee: { id: e.id, full_name: e.full_name }, ...extra });

export const YEAR_DOCUMENTS = [
  // FY 2025 (closed) — full set
  ...EMPLOYEES.slice(0, 8).map((e, i) => empDoc(2025, e, { version: i === 2 ? 2 : 1, sent_at: i % 3 === 0 ? "2026-01-12T10:05:00Z" : null })),
  yearDoc(2025, "SALARY_REGISTER", { version: 2 }),
  yearDoc(2025, "LEAVE_SUMMARY"),
  yearDoc(2025, "LOAN_STATEMENT", { employee_id: 9, employee: { id: 9, full_name: "Imran Sheikh" } }),
  yearDoc(2025, "STAFFING_STATEMENT", { staffing_company_id: 1, staffing_company: STAFFING[0] }),
  yearDoc(2025, "STAFFING_STATEMENT", { staffing_company_id: 2, staffing_company: STAFFING[1] }),
  yearDoc(2025, "OVERTIME_SUMMARY"),
  yearDoc(2025, "HEADCOUNT_REPORT"),
  // FY 2026 (open) — interim register only
  yearDoc(2026, "SALARY_REGISTER", { generated_at: "2026-10-01T09:00:00Z" }),
  yearDoc(2026, "HEADCOUNT_REPORT", { generated_at: "2026-10-01T09:02:00Z" }),
];

export const REPORT_EMPLOYEES = EMPLOYEES.map((e) => ({ id: e.id, full_name: e.full_name, country_emp_id: e.employee_code }));

// Simulates a finished generation job: returns the new document list + a job.
export const generateYearDocs = (docs, yearKey, { types, employee_id, send }) => {
  const now = new Date().toISOString();
  let next = [...docs];
  let done = 0;
  const upsert = (doc_type, match, extra) => {
    const idx = next.findIndex((d) => d.year_key === yearKey && d.doc_type === doc_type && match(d));
    if (idx >= 0) {
      next[idx] = { ...next[idx], version: next[idx].version + 1, generated_at: now, sent_at: send ? now : next[idx].sent_at };
    } else {
      next = [...next, { ...yearDoc(yearKey, doc_type, extra), generated_at: now, sent_at: send ? now : null }];
    }
    done += 1;
  };
  types.forEach((type) => {
    if (type === "ANNUAL_PAY_STATEMENT") {
      const targets = employee_id ? EMPLOYEES.filter((e) => e.id === employee_id) : EMPLOYEES;
      targets.forEach((e) =>
        upsert(type, (d) => d.employee_id === e.id, { employee_id: e.id, employee: { id: e.id, full_name: e.full_name } }),
      );
    } else if (type === "STAFFING_STATEMENT") {
      STAFFING.forEach((s) => upsert(type, (d) => d.staffing_company_id === s.id, { staffing_company_id: s.id, staffing_company: s }));
    } else {
      upsert(type, (d) => !d.employee_id && !d.staffing_company_id, {});
    }
  });
  return { docs: next, job: { status: "DONE", done, failed: 0, total: done, progress: 100 } };
};

// ── Settings → Financial year ────────────────────────────────────────────────
export const FISCAL_SETTINGS = {
  fy_start_month: 1,
  timezone: "Asia/Dubai",
  review_days_before: 30,
  auto_open_next_year: true,
  reopen_window_days: 60,
  lock_mode: "YEARLY",
  pending_on_close: "BLOCK",
  offline_backdate_days: 7,
};

export const FISCAL_YEARS = [
  { id: 4, year_key: 2027, label: "FY 2027", start_date: "2027-01-01", end_date: "2027-12-31", status: "PLANNED", is_locked: false, closed_at: null },
  { id: 2, year_key: 2026, label: "FY 2026", start_date: "2026-01-01", end_date: "2026-12-31", status: "OPEN", is_locked: false, closed_at: null },
  { id: 1, year_key: 2025, label: "FY 2025", start_date: "2025-01-01", end_date: "2025-12-31", status: "CLOSED", is_locked: false, closed_at: "2026-01-20T11:42:00Z" },
  { id: 0, year_key: 2024, label: "FY 2024", start_date: "2024-01-01", end_date: "2024-12-31", status: "CLOSED", is_locked: true, closed_at: "2025-01-25T09:15:00Z" },
];

// Actor of each year's CLOSED event.
export const FISCAL_YEAR_CLOSED_BY = {
  2025: "ahmed@fyinder.com",
  2024: "fatima.alzahra@fyinder.com",
};

// ── Admin dashboard ──────────────────────────────────────────────────────────
const fullTimeCount = EMPLOYEES.filter((e) => e.employment_type === "FULL_TIME").length;
const contractCount = EMPLOYEES.filter((e) => e.employment_type === "CONTRACT").length;

export const DASHBOARD = {
  org: {
    total_employees: 58,
    distribution: { full_time: 31 + fullTimeCount, contract: 13 + contractCount },
    new_hires_this_month: 3,
    active_projects: PROJECTS.filter((p) => p.status === "ACTIVE").length,
  },
  attendance: { total_employees: 58, present: 47, absent: 4, on_leave: 7 },
  docs: {
    summary: { totalExpiring: 6, expired: 1, critical: 2, warning: 3 },
    expiringDocuments: [
      { document_id: 1, employee: { id: 10, name: "Joseph Mathew" }, type: { code: "VISA", label: "Residence Visa" }, expiry_date: daysFromToday(-3), bucket: "EXPIRED", days_remaining: -3 },
      { document_id: 2, employee: { id: 9, name: "Imran Sheikh" }, type: { code: "PASSPORT", label: "Passport" }, expiry_date: daysFromToday(9), bucket: "CRITICAL", days_remaining: 9 },
      { document_id: 3, employee: { id: 7, name: "Khalid Al Otaibi" }, type: { code: "IQAMA", label: "Iqama" }, expiry_date: daysFromToday(14), bucket: "CRITICAL", days_remaining: 14 },
      { document_id: 4, employee: { id: 6, name: "Maria Santos" }, type: { code: "EMIRATES_ID", label: "Emirates ID" }, expiry_date: daysFromToday(33), bucket: "WARNING", days_remaining: 33 },
      { document_id: 5, employee: { id: 12, name: "Bilal Ahmed" }, type: { code: "LABOUR_CARD", label: "Labour Card" }, expiry_date: daysFromToday(41), bucket: "WARNING", days_remaining: 41 },
      { document_id: 6, employee: { id: 3, name: "Rahul Menon" }, type: { code: "VISA", label: "Residence Visa" }, expiry_date: daysFromToday(55), bucket: "WARNING", days_remaining: 55 },
    ],
  },
  approvals: [
    { approval_request_id: 301, can_act: true, entity_type: "LEAVE_REQUEST", employee_name: "Rahul Menon", leave_type: "Annual Leave", from_date: daysFromToday(4), to_date: daysFromToday(6), current_level: 1, total_levels: 2 },
    { approval_request_id: 302, can_act: true, entity_type: "OVERTIME_REQUEST", employee_name: "Khalid Al Otaibi", work_date: daysFromToday(-1), overtime_hours: 4, current_level: 1, total_levels: 1 },
    { approval_request_id: 303, can_act: true, entity_type: "ATTENDANCE_CORRECTION", employee_name: "Maria Santos", work_date: daysFromToday(-2), check_in_time: "08:55", check_out_time: "18:10", current_level: 1, total_levels: 1 },
    { approval_request_id: 304, can_act: true, entity_type: "LEAVE_ENCASHMENT", employee_name: "Youssef Nasser", leave_type: "Annual Leave", total_days: 10, payout_month: "2026-11", current_level: 2, total_levels: 2 },
    { approval_request_id: 305, can_act: true, entity_type: "LEAVE_REQUEST", employee_name: "Ayesha Siddiqui", leave_type: "Sick Leave", from_date: daysFromToday(0), to_date: daysFromToday(1), current_level: 1, total_levels: 1 },
    { approval_request_id: 306, can_act: true, entity_type: "LOAN_REQUEST", module_key: "LOAN", request_code: "LN-2026-0042", employee_name: "Imran Sheikh", current_level: 1, total_levels: 1 },
    { approval_request_id: 307, can_act: false, entity_type: "LEAVE_REQUEST", employee_name: "Bilal Ahmed", leave_type: "Annual Leave", from_date: daysFromToday(12), to_date: daysFromToday(20), current_level: 2, total_levels: 2 },
  ],
  payrollRuns: [
    { id: 41, status: "APPROVED", total_net: 312450, deductions_total: 18620, employee_count: 44 },
    { id: 42, status: "DRAFT", total_net: 64280, deductions_total: 3150, employee_count: 14 },
  ],
  projects: PROJECTS.filter((p) => p.status === "ACTIVE").map((p) => ({
    id: p.id,
    project_name: p.name,
    status: p.status,
    employee_count: p.employee_count,
  })),
  activity: NOTIFICATIONS.slice(0, 4),
};
