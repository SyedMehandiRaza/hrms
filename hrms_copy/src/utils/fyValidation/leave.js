// ─────────────────────────────────────────────────────────────────────────────
// Financial Year — leave & holiday rules (FE-7 / FE-8).
// Mirrors fyinder-backend-nodejs EXACTLY (same limits, enums and message text):
//   • leaveBalance.service.js       validateAdjustment  (POST /leave-balance/:id/adjust)
//   • leaveRequest.service.js       cancelApprovedLeaveService (cancellation_reason)
//   • leavePolicy.validation.js     fyPolicyFields / versionSchema / create schema
//   • leavePolicyHelpers.js         ensureCrossFieldValid
//   • leavePolicy.service.js        createPolicyVersionService (FY start, after current)
//   • holiday.service.js            copyYearService (items.N.<field>)
// Messages live in leaves:validation.* / holidays:validation.* (the backend's
// own EN text; AR taken from the backend AR.json). Change one side → change both.
//
// A check returns null (fine), a message key, or [key, params].
//   const errs = validateLeave(t, adjustChecks, { days, reason }, { available });
//   <input {...register("yearly_quota", leaveRule(t, leaveCheck.yearlyQuota))} />
// ─────────────────────────────────────────────────────────────────────────────

export const LEAVE_LIMITS = {
  adjustMax: 365,
  adjustReasonMin: 10,
  adjustReasonMax: 500,
  cancelReasonMin: 5,
  cancelReasonMax: 500,
  carryExpiryMax: 36,
  quotaMax: 365,
  accrualDayMax: 31,
  holidayNameMin: 2,
  holidayNameMax: 200,
  copyItemsMax: 500,
};

export const YEAR_END_EXCESS = ["LAPSE", "ENCASH"];
export const ACCRUAL_METHODS = ["MONTHLY_ACCRUAL", "UPFRONT"];
export const ACCRUAL_FREQUENCIES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"];
export const HOLIDAY_COPY_FLAGS = ["CHECK_DATE", "CONFLICT", "ALREADY_COPIED"];

// Defaults the backend applies when a policy has no FY rules yet (fyFieldsOf).
export const DEFAULT_POLICY_FY = {
  carry_forward_expiry_months: 0,
  year_end_excess: "LAPSE",
  accrual_method: "MONTHLY_ACCRUAL",
  prorate_joiners: true,
};

const L = "leaves:validation.";
const H = "holidays:validation.";

const blank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const toNum = (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const twoDecimals = (n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const isYesNo = (v) => v === true || v === false || v === "true" || v === "false";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isRealDate = (v) => {
  if (typeof v !== "string" || !ISO_DATE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

export const leaveCheck = {
  // ── balance adjustment (ctx.available = the row's available balance) ──
  adjustDays: (v, _values, ctx = {}) => {
    const n = toNum(v);
    if (!isNum(n)) return L + "adjustDaysRequired";
    if (n === 0) return L + "adjustDaysZero";
    if (!twoDecimals(n)) return L + "adjustDaysDecimals";
    if (Math.abs(n) > LEAVE_LIMITS.adjustMax) return L + "adjustDaysRange";
    if (ctx.available !== undefined && ctx.available !== null && r2(Number(ctx.available) + n) < 0) {
      return [L + "adjustBelowZero", { available: r2(ctx.available) }];
    }
    return null;
  },
  adjustReason: (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length >= LEAVE_LIMITS.adjustReasonMin && s.length <= LEAVE_LIMITS.adjustReasonMax ? null : L + "adjustReason";
  },

  // ── cancel an approved leave ──
  cancelReason: (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length >= LEAVE_LIMITS.cancelReasonMin && s.length <= LEAVE_LIMITS.cancelReasonMax ? null : L + "cancelReason";
  },

  // ── policy: financial-year rules (all optional) ──
  carryExpiry: (v) => {
    if (blank(v)) return null;
    const n = toNum(v);
    return isNum(n) && Number.isInteger(n) && n >= 0 && n <= LEAVE_LIMITS.carryExpiryMax ? null : L + "carryExpiry";
  },
  yearEndExcess: (v) => (blank(v) || YEAR_END_EXCESS.includes(v) ? null : L + "yearEndExcess"),
  accrualMethod: (v) => (blank(v) || ACCRUAL_METHODS.includes(v) ? null : L + "accrualMethod"),
  prorateJoiners: (v) => (v === undefined || isYesNo(v) ? null : L + "yesNo"),

  // ── policy: quota / caps (create schema + ensureCrossFieldValid) ──
  yearlyQuota: (v) => {
    if (blank(v)) return null;
    const n = toNum(v);
    return isNum(n) && n >= 0 && n <= LEAVE_LIMITS.quotaMax ? null : L + "quotaRange";
  },
  monthlyAccrual: (v) => {
    if (blank(v)) return null;
    const n = toNum(v);
    return isNum(n) && n >= 0 ? null : L + "number";
  },
  // values.allow → the matching on/off switch
  maxCarryForward: (v, values = {}) => (values.carryForward && !(Number(v) > 0) ? L + "maxCarryForward" : null),
  maxEncashment: (v, values = {}) => (values.encashment && !(Number(v) > 0) ? L + "maxEncashment" : null),
  effectiveTo: (v, values = {}) =>
    !blank(v) && !blank(values.effective_from) && v <= values.effective_from ? L + "effectiveToAfter" : null,

  // ── policy version start (ctx.years = fy.years, ctx.currentFrom = current version start) ──
  versionFrom: (v, _values, ctx = {}) => {
    if (blank(v) || !ISO_DATE.test(v)) return L + "versionFrom";
    const years = ctx.years || [];
    if (years.length && !years.some((y) => y.start_date === v)) {
      const next = years.find((y) => y.start_date > v);
      return [L + "versionFyStart", { date: next ? next.start_date : v }];
    }
    if (ctx.currentFrom && v <= String(ctx.currentFrom).slice(0, 10)) {
      return [L + "versionAfter", { date: String(ctx.currentFrom).slice(0, 10) }];
    }
    return null;
  },
};

export const adjustChecks = { days: leaveCheck.adjustDays, reason: leaveCheck.adjustReason };
export const cancelChecks = { cancellation_reason: leaveCheck.cancelReason };

// Translate one check result.
export const leaveMsg = (t, res) => {
  if (!res) return null;
  return Array.isArray(res) ? t(res[0], res[1]) : t(res);
};

// Validate a whole object → { field: message } (empty = valid).
export const validateLeave = (t, checks, values, ctx) => {
  const out = {};
  for (const [field, fn] of Object.entries(checks)) {
    const msg = leaveMsg(t, fn(values[field], values, ctx));
    if (msg) out[field] = msg;
  }
  return out;
};

// react-hook-form rule: validate(v, formValues) → message | true.
export const leaveRule = (t, fn, ctx) => ({
  validate: (v, values) => leaveMsg(t, fn(v, values, ctx)) || true,
});

// ── Holiday copy (POST /holidays/copy-year) ──────────────────────────────────
// rows: [{ source_id, holiday_name, holiday_date, include, city_id, flags, proposed_date }]
// to  : { from, to, label } of the target FY
// → { "items.N.holiday_date": message, "items.N.source_id": …, "items.N.holiday_name": … }
// (N = the row's index in the list sent to the server, like the backend.)
export const holidayCopyErrors = (t, rows, to) => {
  const errors = {};
  const seen = new Set();
  rows.forEach((r, idx) => {
    if (r.include === false) return;
    const p = `items.${idx}.`;
    if ((r.flags || []).includes("ALREADY_COPIED")) {
      errors[p + "source_id"] = t(H + "copyAlready");
    }
    const name = String(r.holiday_name ?? "").trim();
    if (name.length < LEAVE_LIMITS.holidayNameMin || name.length > LEAVE_LIMITS.holidayNameMax) {
      errors[p + "holiday_name"] = t(H + "copyName");
    }
    const date = typeof r.holiday_date === "string" ? r.holiday_date.trim().slice(0, 10) : "";
    if (!isRealDate(date)) {
      errors[p + "holiday_date"] = t(H + "copyDate");
      return;
    }
    if (to && (date < to.from || date > to.to)) {
      errors[p + "holiday_date"] = t(H + "copyDateInFy", { label: to.label });
      return;
    }
    const key = `${r.city_id ?? "global"}|${date}`;
    if ((r.flags || []).includes("CONFLICT") && date === r.proposed_date) {
      errors[p + "holiday_date"] = t(H + "copyConflict");
    } else if (seen.has(key)) {
      errors[p + "holiday_date"] = t(H + "copyDuplicate");
    }
    seen.add(key);
  });
  return errors;
};
