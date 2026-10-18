// ─────────────────────────────────────────────────────────────────────────────
// Leave encashment request — the FRONTEND half of the rules.
// Mirrors fyinder-backend-nodejs utils/newHrms/leaveEncashment.validation.js
// EXACTLY (same limits, same order, same messages). Messages live in
// leaves:encashment.validation.* (the backend's EN text; AR = the backend's AR).
// Change one side → change both.
//
// The context comes from GET /leave-encashments/options:
//   const ctx = encashmentContext(options);
//   const errors = validateEncashment(t, values, ctx);   // { field: message }
//   <input {...register("days", encashmentRule(t, "days", ctx))} />
// ─────────────────────────────────────────────────────────────────────────────

export const ENCASHMENT_LIMITS = { reasonMax: 500, daysMax: 365, step: 0.5 };
export const ENCASHMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "PAID"];

const V = "leaves:encashment.validation.";
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const blank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const toNum = (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// "2026-11" → "11/2026" (the backend's {{month}} format)
export const encashMonthLabel = (ym) => (ym ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : "");

// Options payload → the validation context (the backend's ctx shape).
export const encashmentContext = (options) => {
  if (!options) return null;
  const types = {};
  (options.leave_types || []).forEach((lt) => {
    types[lt.leave_type_id] = {
      encashable: lt.encashable !== false,
      available: lt.available,
      max_days: lt.max_days,
      already_encashed: lt.already_encashed,
      has_pending: !!lt.has_pending,
    };
  });
  const rates = {};
  (options.months || []).forEach((m) => {
    if (m.daily_rate !== null && m.daily_rate !== undefined) rates[m.month] = m.daily_rate;
  });
  return {
    employee_status: options.employee?.employment_status || "ACTIVE",
    last_working_day: options.employee?.last_working_day || null,
    min_month: options.min_month,
    max_month: options.max_month,
    closed_months: options.closed_months || [],
    rates,
    types,
  };
};

// One field's first failing rule → [key, params] | key | null.
export const encashmentCheck = {
  employee_id: (_v, _values, ctx = {}) =>
    ctx.employee_status && !["ACTIVE", "IN_NOTICE"].includes(ctx.employee_status) ? V + "employeeInactive" : null,
  leave_type_id: (v, _values, ctx = {}) => {
    const id = toNum(v);
    if (blank(v) || !isNum(id) || !(id > 0)) return V + "typeRequired";
    const type = (ctx.types || {})[id];
    if (!type || !type.encashable) return V + "typeNotEncashable";
    if (type.has_pending) return V + "typePending";
    return null;
  },
  days: (v, values = {}, ctx = {}) => {
    const days = toNum(v);
    if (blank(v) || !isNum(days)) return V + "daysRequired";
    if (!(days > 0)) return V + "daysPositive";
    if (Math.abs(days * 2 - Math.round(days * 2)) > 1e-9) return V + "daysStep";
    if (days > ENCASHMENT_LIMITS.daysMax) return [V + "daysMax", { max: ENCASHMENT_LIMITS.daysMax }];
    const typeId = toNum(values.leave_type_id);
    const type = isNum(typeId) ? (ctx.types || {})[typeId] : null;
    if (type && type.encashable) {
      const available = r2(type.available);
      const max = r2(type.max_days || 0);
      const left = r2(Math.max(0, max - r2(type.already_encashed || 0)));
      if (days > available) return [V + "daysAvailable", { available: Math.max(0, available) }];
      if (max > 0 && days > left) return [V + "daysCap", { left, max }];
    }
    return null;
  },
  payout_month: (v, _values, ctx = {}) => {
    const pm = typeof v === "string" ? v.trim() : v;
    if (blank(pm)) return V + "monthRequired";
    if (typeof pm !== "string" || !MONTH_RE.test(pm)) return V + "monthFormat";
    if (ctx.last_working_day && pm > ctx.last_working_day.slice(0, 7)) {
      return [V + "monthAfterLwd", { date: ctx.last_working_day }];
    }
    if (!ctx.min_month || !ctx.max_month || pm < ctx.min_month || pm > ctx.max_month) {
      return [V + "monthWindow", { min: encashMonthLabel(ctx.min_month), max: encashMonthLabel(ctx.max_month) }];
    }
    if ((ctx.closed_months || []).includes(pm)) return [V + "monthClosed", { month: encashMonthLabel(pm) }];
    if (ctx.rates && Object.prototype.hasOwnProperty.call(ctx.rates, pm) && !(Number(ctx.rates[pm]) > 0)) {
      return [V + "noSalary", { month: encashMonthLabel(pm) }];
    }
    return null;
  },
  reason: (v) => (!blank(v) && String(v).trim().length > ENCASHMENT_LIMITS.reasonMax ? V + "reasonMax" : null),
};

const msgOf = (t, res) => {
  if (!res) return null;
  return Array.isArray(res) ? t(res[0], res[1]) : t(res);
};

// Every field's message at once → { field: message } (empty = valid).
export const validateEncashment = (t, values, ctx) => {
  const out = {};
  for (const [field, fn] of Object.entries(encashmentCheck)) {
    const m = msgOf(t, fn(values[field], values, ctx || {}));
    if (m) out[field] = m;
  }
  return out;
};

// react-hook-form rule for one field.
export const encashmentRule = (t, field, ctx) => ({
  validate: (v, values) => msgOf(t, encashmentCheck[field](v, values, ctx || {})) || true,
});

// Live estimate: days × the payout month's daily rate (null when unknown).
export const encashmentEstimate = (days, month, ctx) => {
  const d = toNum(days);
  const rate = ctx && ctx.rates ? ctx.rates[month] : undefined;
  if (!isNum(d) || !(d > 0) || rate === undefined || rate === null) return null;
  return r2(d * Number(rate));
};
