// ─────────────────────────────────────────────────────────────────────────────
// Payroll — client rules that mirror the backend EXACTLY (same limits, enums,
// message text; Arabic = backend middlewares/i18n/AR.json for the same phrase).
// Change one side → change the other.
//
//   Salary increments  ↔ fyinder-backend-nodejs
//                        src/utils/newHrms/payroll/increment.validation.js
//                        (checkBatch / checkLine; the effective-month DB rules
//                        — closed FY, payroll lock, submitted run — stay on the
//                        server and come back as field errors)
//   Salary transactions ↔ src/utils/newHrms/payroll/transaction.validation.js
//                        (createTxSchema)
// ─────────────────────────────────────────────────────────────────────────────

export const INCREMENT_TYPES = ["PERCENT", "AMOUNT"];
export const INCREMENT_APPLIES_TO = ["BASIC_ONLY", "ALL_FIXED"];
export const INCREMENT_STATUSES = ["DRAFT", "APPLIED", "REVERTED"];
export const INCREMENT_KINDS = ["BULK", "SINGLE"]; // SINGLE = one employee's increment, applied at once
export const INCREMENT_FILTER_KEYS = ["department_ids", "project_ids", "designation_ids", "employee_ids"];

export const INCREMENT_LIMITS = {
  titleMin: 2,
  titleMax: 150,
  percentMin: 0.01,
  percentMax: 100,
  amountMax: 9999999.99,
  yearMin: 2000,
  yearMax: 2100,
  noteMax: 500,
};

export const TX_LIMITS = { labelMax: 150, yearMin: 2000, yearMax: 2100 };

const isInt = (v) =>
  (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v.trim()))) && Number.isInteger(Number(v));

// Raw-text decimal: digits with up to 2 decimals → number, else null
// ("1e3", "10.005", "-5" are rejected, never converted / rounded).
export const rawDecimal = (v) => {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const s = String(v).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
};

const filtersOk = (f) => {
  if (f === undefined || f === null) return true;
  if (typeof f !== "object" || Array.isArray(f)) return false;
  return Object.entries(f).every(
    ([k, v]) =>
      INCREMENT_FILTER_KEYS.includes(k) &&
      (v === null || v === undefined || (Array.isArray(v) && v.every((x) => isInt(x) && Number(x) > 0))),
  );
};

// Plain checks → message key under payroll:validation.increment (null = fine).
export const incrementCheck = {
  title: (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length < INCREMENT_LIMITS.titleMin || s.length > INCREMENT_LIMITS.titleMax ? "title" : null;
  },
  type: (v) => (INCREMENT_TYPES.includes(typeof v === "string" ? v.trim().toUpperCase() : "") ? null : "type"),
  value: (v, all = {}) => {
    const n = rawDecimal(v);
    const type = typeof all.type === "string" ? all.type.trim().toUpperCase() : "";
    if (type === "PERCENT") {
      return n === null || n < INCREMENT_LIMITS.percentMin || n > INCREMENT_LIMITS.percentMax ? "percent" : null;
    }
    return n === null || !(n > 0) || n > INCREMENT_LIMITS.amountMax ? "amount" : null;
  },
  applies_to: (v) => {
    const raw = v === undefined || v === null || v === "" ? "BASIC_ONLY" : v;
    return INCREMENT_APPLIES_TO.includes(typeof raw === "string" ? raw.trim().toUpperCase() : "") ? null : "appliesTo";
  },
  effective_month: (v) => (!isInt(v) || Number(v) < 1 || Number(v) > 12 ? "month" : null),
  effective_year: (v) =>
    !isInt(v) || Number(v) < INCREMENT_LIMITS.yearMin || Number(v) > INCREMENT_LIMITS.yearMax ? "year" : null,
  filters: (v) => (filtersOk(v) ? null : "filters"),
};

export const incrementLineCheck = {
  excluded: (v) =>
    v === undefined || typeof v === "boolean" || v === "true" || v === "false" ? null : "excluded",
  note: (v) =>
    v === undefined || v === null || v === "" || (typeof v === "string" && v.trim().length <= INCREMENT_LIMITS.noteMax)
      ? null
      : "note",
};

// Validate a whole batch → { field: message } (empty = valid).
//   values: { title, type, value, applies_to, effective_month, effective_year, filters }
export const validateIncrement = (t, values) => {
  const out = {};
  for (const [field, fn] of Object.entries(incrementCheck)) {
    const key = fn(values[field], values);
    if (key) out[field] = t(`payroll:validation.increment.${key}`);
  }
  return out;
};

export const validateIncrementLine = (t, values) => {
  const out = {};
  for (const [field, fn] of Object.entries(incrementLineCheck)) {
    const key = fn(values[field], values);
    if (key) out[field] = t(`payroll:validation.increment.${key}`);
  }
  return out;
};

// ── One employee's increment ─────────────────────────────────────────────────
// ↔ increment.validation.js checkSingle (POST /payroll/employees/:id/increments)
//   type / value / applies_to: the batch rules above; effective_date a real
//   "YYYY-MM-DD" date in 2000–2100; reason trimmed 5–500. The DB rules (closed
//   FY, locked month, employee paid, later salary row, no salary yet) come back
//   from the server under effective_date.
export const SINGLE_INCREMENT_LIMITS = { reasonMin: 5, reasonMax: 500 };

export const isRealDate = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return false;
  const [y, m, d] = v.trim().split("-").map(Number);
  if (y < INCREMENT_LIMITS.yearMin || y > INCREMENT_LIMITS.yearMax || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export const singleIncrementCheck = {
  type: incrementCheck.type,
  value: incrementCheck.value,
  applies_to: incrementCheck.applies_to,
  effective_date: (v) => (isRealDate(v) ? null : "effectiveDate"),
  reason: (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length < SINGLE_INCREMENT_LIMITS.reasonMin || s.length > SINGLE_INCREMENT_LIMITS.reasonMax ? "reason" : null;
  },
};

// → { field: message } (empty = valid).
//   values: { type, value, applies_to, effective_date, reason }
export const validateSingleIncrement = (t, values) => {
  const out = {};
  for (const [field, fn] of Object.entries(singleIncrementCheck)) {
    const key = fn(values[field], values);
    if (key) out[field] = t(`payroll:validation.increment.${key}`);
  }
  return out;
};

// Live preview of an increment on a salary (mirror of increment.service
// applyIncrement + resolveSalary). `lines`: the salary's earnings + deductions
// as the salary API returns them ({ code, name, type, calculation_type,
// amount, percent_base }); `mode`: salary_calc_mode.
//   → { oldBasic, newBasic, oldGross, newGross } (null basic when none)
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const grossOfLines = (lines, amounts) => {
  const fixedByName = {};
  lines.forEach((l, i) => {
    if (l.calculation_type === "FIXED") {
      const k = String(l.name || "").toUpperCase();
      fixedByName[k] = r2((fixedByName[k] || 0) + Number(amounts[i] || 0));
    }
  });
  return r2(
    lines.reduce((s, l, i) => {
      if (l.type !== "EARNING") return s;
      if (l.calculation_type === "FIXED") return s + r2(amounts[i]);
      const base = (Array.isArray(l.percent_base) && l.percent_base.length ? l.percent_base : ["BASIC"]).reduce(
        (b, code) => b + (fixedByName[String(code).toUpperCase()] || 0),
        0,
      );
      return s + r2((Number(amounts[i]) / 100) * base);
    }, 0),
  );
};

export const previewIncrement = ({ lines = [], mode = "MONTHLY_FIXED", type, value, applies_to: appliesTo }) => {
  const baseCode = mode === "HOURLY" ? "HOURLY" : "BASIC";
  const isBase = (l) => l.calculation_type === "FIXED" && String(l.code || "").toUpperCase() === baseCode;
  const old = lines.map((l) => Number(l.amount) || 0);
  const v = rawDecimal(value);
  const next =
    v === null
      ? old
      : lines.map((l, i) => {
        const amt = old[i];
        if (type === "AMOUNT") return isBase(l) ? r2(amt + v) : amt;
        if (appliesTo === "ALL_FIXED") return l.calculation_type === "FIXED" && l.type === "EARNING" ? r2(amt * (1 + v / 100)) : amt;
        return isBase(l) ? r2(amt * (1 + v / 100)) : amt;
      });
  const bi = lines.findIndex(isBase);
  return {
    oldBasic: bi < 0 ? null : r2(old[bi]),
    newBasic: bi < 0 ? null : r2(next[bi]),
    oldGross: grossOfLines(lines, old),
    newGross: grossOfLines(lines, next),
  };
};

// ── Salary transactions (react-hook-form rules) ──────────────────────────────
// createTxSchema: label trim, required, max 150; amount positive; the period
// is one month (the picker keeps it inside the selected financial year).
export const transactionRules = (t) => ({
  month: {
    validate: (v) =>
      /^\d{4}-\d{2}$/.test(v || "") &&
      Number(v.slice(0, 4)) >= TX_LIMITS.yearMin &&
      Number(v.slice(0, 4)) <= TX_LIMITS.yearMax
        ? true
        : t("payroll:transactionModal.monthRequired"),
  },
  label: {
    validate: (v) => {
      const s = typeof v === "string" ? v.trim() : "";
      if (!s) return t("payroll:transactionModal.labelRequired");
      if (s.length > TX_LIMITS.labelMax) return t("payroll:validation.labelMax", { max: TX_LIMITS.labelMax });
      return true;
    },
  },
  amount: {
    validate: (v) => {
      if (v === "" || v === null || v === undefined) return t("payroll:transactionModal.amountRequired");
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? true : t("payroll:transactionModal.amountMin");
    },
  },
});

// ── Payslip ad-hoc lines ─────────────────────────────────────────────────────
// ↔ src/utils/newHrms/payroll/payslipItem.validation.js (addItemSchema):
// type INCENTIVE | DEDUCTION; label trim 1–150; amount a number ≥ 0.
export const PAYSLIP_LINE_TYPES = ["INCENTIVE", "DEDUCTION"];

export const lineCheck = {
  type: (v) => (PAYSLIP_LINE_TYPES.includes(String(v || "").toUpperCase()) ? null : "lineType"),
  label: (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length >= 1 && s.length <= TX_LIMITS.labelMax ? null : "lineLabel";
  },
  amount: (v) => {
    if (v === "" || v === null || v === undefined) return "lineAmount";
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? null : "lineAmount";
  },
};

// → { type?, label?, amount? } translated messages (empty = valid).
export const lineChecks = (t, values) => {
  const out = {};
  for (const [field, fn] of Object.entries(lineCheck)) {
    const key = fn(values[field], values);
    if (key) out[field] = t(`payroll:validation.${key}`, { max: TX_LIMITS.labelMax });
  }
  return out;
};
