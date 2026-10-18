// ─────────────────────────────────────────────────────────────────────────────
// Financial Year — core rules (settings, month locks, reopen, reports).
// Mirrors fyinder-backend-nodejs src/utils/newHrms/fiscalYear.validation.js and
// constants/fiscalYear.constants.js EXACTLY: same limits, same enums, same
// messages (fiscalYear:validation.* hold the backend's own EN / AR text).
// Change one side → change the other.
//
//   const R = fyCoreRules(t);
//   <select {...register("fy_start_month", R.fy_start_month)} />
// ─────────────────────────────────────────────────────────────────────────────

export const LIMITS = {
  reviewDaysMax: 120,
  reopenWindowMax: 30,
  offlineBackdateMax: 30,
  reasonMin: 5,
  reasonMax: 500,
  yearMin: 2000,
  yearMax: 2100,
};

export const LOCK_MODES = ["YEARLY", "MONTHLY"];
export const PENDING_ON_CLOSE = ["BLOCK", "CANCEL", "CARRY"];
export const FY_STATUSES = ["PLANNED", "OPEN", "CLOSING", "CLOSED"];
export const LOCK_MODULES = ["ALL", "ATTENDANCE", "LEAVE", "PAYROLL", "BILLING"];
export const CLOSE_STEPS = ["READINESS", "LEAVE", "PAYROLL", "BILLING", "SETUP", "CLOSE"];
export const CLOSE_STEP_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"];
export const YEAR_DOC_TYPES = [
  "ANNUAL_PAY_STATEMENT",
  "SALARY_REGISTER",
  "LEAVE_SUMMARY",
  "LOAN_STATEMENT",
  "STAFFING_STATEMENT",
  "OVERTIME_SUMMARY",
  "HEADCOUNT_REPORT",
];
export const DEFAULT_TIME_SETTINGS = {
  timezone: "Asia/Riyadh",
  fy_start_month: 1,
  review_days_before: 30,
  auto_open_next_year: true,
  reopen_window_days: 7,
  lock_mode: "YEARLY",
  pending_on_close: "BLOCK",
  offline_backdate_days: 3,
};

// Same test as the backend's companyTime.isValidTimezone (Intl knows the zone).
export const isValidTimezone = (tz) => {
  if (typeof tz !== "string" || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
};

// Every IANA zone the browser knows (for the searchable list).
export const timezoneList = () => {
  try {
    if (typeof Intl.supportedValuesOf === "function") return Intl.supportedValuesOf("timeZone");
  } catch {
    // fall through
  }
  return ["Asia/Riyadh", "Asia/Dubai", "Asia/Kolkata", "Asia/Calcutta", "Asia/Qatar", "Asia/Kuwait", "Asia/Bahrain", "Asia/Muscat", "Africa/Cairo", "Europe/London", "UTC"];
};

const isIntIn = (v, min, max) => {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max;
};
const isYesNo = (v) => v === true || v === false || v === "true" || v === "false";

// Plain checks → message key (null = fine). Shared by the rules below and tests.
export const check = {
  fy_start_month: (v) => (isIntIn(v, 1, 12) ? null : "startMonth"),
  timezone: (v) => (isValidTimezone(v) ? null : "timezone"),
  review_days_before: (v) => (isIntIn(v, 0, LIMITS.reviewDaysMax) ? null : "reviewDays"),
  auto_open_next_year: (v) => (isYesNo(v) ? null : "yesNo"),
  reopen_window_days: (v) => (isIntIn(v, 0, LIMITS.reopenWindowMax) ? null : "reopenWindow"),
  lock_mode: (v) => (LOCK_MODES.includes(v) ? null : "lockMode"),
  pending_on_close: (v) => (PENDING_ON_CLOSE.includes(v) ? null : "pendingOnClose"),
  offline_backdate_days: (v) => (isIntIn(v, 0, LIMITS.offlineBackdateMax) ? null : "offlineBackdate"),
  period_year: (v) => (isIntIn(v, LIMITS.yearMin, LIMITS.yearMax) ? null : "year"),
  period_month: (v) => (isIntIn(v, 1, 12) ? null : "month"),
  module: (v) => (v === undefined || v === "" || LOCK_MODULES.includes(v) ? null : "module"),
  reason: (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length >= LIMITS.reasonMin && s.length <= LIMITS.reasonMax ? null : "reason";
  },
  types: (v) =>
    v === undefined || (Array.isArray(v) && v.length > 0 && v.every((x) => YEAR_DOC_TYPES.includes(x)))
      ? null
      : "docType",
};

// react-hook-form rules (validate returns the translated message or true).
const rule = (t, fn) => ({
  validate: (v) => {
    const key = fn(v);
    return key ? t(`fiscalYear:validation.${key}`) : true;
  },
});

export const fyCoreRules = (t) =>
  Object.fromEntries(Object.entries(check).map(([field, fn]) => [field, rule(t, fn)]));

// Validate a whole object at once → { field: message } (empty = valid).
// Used by forms that are not react-hook-form (modals with local state).
export const validateWith = (t, checks, values) => {
  const out = {};
  for (const [field, fn] of Object.entries(checks)) {
    const key = fn(values[field], values);
    if (key) out[field] = t(`fiscalYear:validation.${key}`);
  }
  return out;
};

export const settingsChecks = {
  fy_start_month: check.fy_start_month,
  timezone: check.timezone,
  review_days_before: check.review_days_before,
  auto_open_next_year: check.auto_open_next_year,
  reopen_window_days: check.reopen_window_days,
  lock_mode: check.lock_mode,
  pending_on_close: check.pending_on_close,
  offline_backdate_days: check.offline_backdate_days,
};
export const lockChecks = {
  period_year: check.period_year,
  period_month: check.period_month,
  module: check.module,
  reason: check.reason,
};
export const reopenChecks = { reason: check.reason };
