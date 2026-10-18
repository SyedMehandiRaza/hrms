// Readiness item key → where to fix it in this app (backend `link`s point at
// paths of the old UI). `to` = a path, or (item) => path; its query preselects
// the target list's filter with the same values that page's filter uses
// (the year itself comes from the header switcher, set before navigating).
// `step` = a step of the year-end wizard itself; `nextYear` = the fix belongs
// to the following FY (select that one instead).
const firstMonth = (item) => (Array.isArray(item?.months) && item.months[0]) || "";

export const READINESS_FIX = {
  year_ended: null,
  pending_leave: { to: "/admin/leave-management/view-all-requests?status=PENDING" },
  pending_overtime: { to: "/admin/attendance/request?status=PENDING" },
  pending_corrections: { to: "/admin/attendance/correction-requests?status=PENDING" },
  pending_exit_visas: { to: "/admin/visa-management?status=PENDING_APPROVAL" },
  pending_loans: { to: "/admin/loan-approvals?status=PENDING" },
  pending_leave_encashments: { to: "/admin/leave-encashments?status=PENDING" },
  // no run yet for those months — the overview is where a run is started
  payroll_not_generated: { to: "/admin/payroll-overview" },
  // runs not yet credited are in several statuses: open the first such month
  payroll_not_credited: {
    to: (item) => (firstMonth(item) ? `/admin/payroll-overview?month=${firstMonth(item)}` : "/admin/payroll-overview"),
  },
  staffing_bills_open: { to: "/admin/staffing-billing" },
  exits_in_notice: { to: "/admin/exits?status=IN_NOTICE" },
  exits_unconfirmed: { to: "/admin/exits?status=EXITED&awaiting=1" },
  next_year_holidays_missing: { to: "/admin/holiday-management", nextYear: true },
  leave_not_closed: { step: "LEAVE" },
  annual_reports_missing: { step: "PAYROLL" },
};

// The path for a fix entry (string or function of the readiness item).
export const fixPath = (fix, item) => (typeof fix?.to === "function" ? fix.to(item) : fix?.to);

export const READINESS_ORDER = { BLOCK: 0, WARN: 1, OK: 2 };
