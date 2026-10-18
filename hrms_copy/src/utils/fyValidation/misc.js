// ─────────────────────────────────────────────────────────────────────────────
// Financial Year — misc rules (contract term dates, employee joining date).
// Mirrors fyinder-backend-nodejs EXACTLY:
//   • contract term → backend newHrms/contract.service.js cleanTermDates
//     (start_date / end_date / renewal_due: optional, a real YYYY-MM-DD date;
//      end_date on/after start_date)
//   • date_of_joining → backend newHrms/employee.service.js checkDateOfJoining
//     (a real YYYY-MM-DD date, at most 1 year ahead of today, company time;
//      optional on create — the backend then uses today)
// Messages: fiscalYear:validation.* (the backend's own EN / AR text).
// Change one side → change the other.
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");
const blank = (v) => v === undefined || v === null || String(v).trim() === "";

// Same test as the backend's isRealDate: "YYYY-MM-DD" that exists on the calendar.
export const isRealYmd = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? "").trim());
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
};

// companyTime.addMonths: same day n months later, clamped to the month's end.
export const addMonthsYmd = (s, n) => {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
};

// The latest joining date allowed ("YYYY-MM-DD"), given today in company time.
export const maxJoiningDate = (today) => addMonthsYmd(today, 12);

// ── contract term ────────────────────────────────────────────────────────────
export const CONTRACT_TERM_FIELDS = ["start_date", "end_date", "renewal_due"];

// → { field: message } for { start_date, end_date, renewal_due } (blank = none).
export const validateContractTerm = (t, values = {}) => {
  const out = {};
  for (const f of CONTRACT_TERM_FIELDS) {
    if (!blank(values[f]) && !isRealYmd(values[f])) out[f] = t("fiscalYear:validation.termDateInvalid");
  }
  const start = blank(values.start_date) ? null : String(values.start_date).trim();
  const end = blank(values.end_date) ? null : String(values.end_date).trim();
  if (start && end && !out.start_date && !out.end_date && end < start) {
    out.end_date = t("fiscalYear:validation.termEndBeforeStart");
  }
  return out;
};

// ── employee joining date ────────────────────────────────────────────────────
// → "" when fine, else the message. `required` for edit (the field is sent).
export const checkJoiningDate = (t, value, today, { required = false } = {}) => {
  if (blank(value)) return required ? t("fiscalYear:validation.joiningDateInvalid") : "";
  const v = String(value).trim();
  if (!isRealYmd(v)) return t("fiscalYear:validation.joiningDateInvalid");
  if (today && v > maxJoiningDate(today)) return t("fiscalYear:validation.joiningDateTooFar");
  return "";
};

// react-hook-form rule: register("dateOfJoining", joiningDateRule(t, fy.today))
export const joiningDateRule = (t, today, opts) => ({
  validate: (v) => checkJoiningDate(t, v, today, opts) || true,
});
