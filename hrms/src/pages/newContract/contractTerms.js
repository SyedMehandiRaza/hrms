// Contract terms shared by the send wizard and the viewer's "Edit terms" (plan decisions 18–22).

export const RATE_UNITS = ["HOURLY", "DAILY", "MONTHLY", "ANNUAL"];
export const TERM_KEYS = ["start_date", "end_date", "renewal_due", "sign_by", "rate", "rate_unit", "currency", "notice_period_days"];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isRealYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && ymd(new Date(`${v}T00:00:00`)) === v;
export const blank = (v) => v === undefined || v === null || String(v).trim() === "";

// Client-side checks with the server's texts (standards §7.3 "Draft / send"); rules that
// depend on the company's today (end in the past, sign-by range) are the server's.
export const validateTerms = (t, v) => {
  const e = {};
  const msg = (k) => t(`wizard.terms.validation.${k}`);
  if (blank(v.start_date)) e.start_date = msg("startDateRequired");
  ["start_date", "end_date", "renewal_due"].forEach((k) => {
    if (!blank(v[k]) && !isRealYmd(v[k])) e[k] = msg("dateInvalid");
  });
  if (!e.start_date && !e.end_date && !blank(v.end_date) && v.end_date < v.start_date) e.end_date = msg("endBeforeStart");
  if (!blank(v.rate)) {
    const n = Number(v.rate);
    if (!(n > 0) || Math.abs(Math.round(n * 100) - n * 100) > 1e-6 || n > 9999999999.99) e.rate = msg("rateInvalid");
    else if (blank(v.rate_unit)) e.rate_unit = msg("rateUnitRequired");
  }
  if (!/^[A-Za-z]{3}$/.test(String(v.currency || "").trim())) e.currency = msg("currencyInvalid");
  if (!blank(v.notice_period_days)) {
    const n = Number(v.notice_period_days);
    if (!Number.isInteger(n) || n < 0 || n > 365) e.notice_period_days = msg("noticePeriodRange");
  }
  return e;
};

// Form values → API body.
export const termsBody = (term) => ({
  start_date: term.start_date,
  end_date: term.end_date || null,
  renewal_due: term.renewal_due || null,
  sign_by: term.sign_by || null,
  rate: blank(term.rate) ? null : Number(term.rate),
  rate_unit: blank(term.rate) ? null : term.rate_unit || null,
  currency: term.currency.trim().toUpperCase(),
  notice_period_days: blank(term.notice_period_days) ? null : Number(term.notice_period_days),
});

// API contract → form values.
export const termsOf = (c) => ({
  start_date: c.start_date || "",
  end_date: c.end_date || "",
  renewal_due: c.renewal_due || "",
  sign_by: c.sign_by || "",
  rate: c.rate == null ? "" : String(c.rate),
  rate_unit: c.rate_unit || "",
  currency: c.currency || "",
  notice_period_days: c.notice_period_days == null ? "" : String(c.notice_period_days),
});

export const inputCls = (bad) =>
  `w-full px-3 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${bad ? "border-red-500" : "border-gray-200"}`;
