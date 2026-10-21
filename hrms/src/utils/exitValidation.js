// ─────────────────────────────────────────────────────────────────────────────
// Employee Exit — the FRONTEND half of the shared validation rules (V1–V26).
//
// Mirrors fyinder-backend-nodejs src/utils/newHrms/exit.validation.js EXACTLY:
// same limits (LIMITS), same rules, same messages (the `exits:validation.*`
// keys hold the backend's own English/Arabic text). Change one side → change
// the other. Every exit form must use these rules — no ad-hoc rules.
//
// Usage with react-hook-form:
//   const R = exitRules(t, { outstandingLoan: 1000, rehireAllowedFrom: "2027-01-12" });
//   <input {...register("reason", R.reason)} />
// Server errors: utils/applyFieldErrors.js maps the backend's per-field
// messages onto the same inputs.
// ─────────────────────────────────────────────────────────────────────────────

export const LIMITS = {
  reasonMin: 10,
  reasonMax: 1000,
  noticeStartWindowDays: 90,
  noticeDaysMax: 180,
  lwdMaxAfterStartDays: 365,
  coolingDaysMax: 1095,
  noteMax: 500,
  naNoteMin: 3,
  labelMin: 2,
  labelMax: 150,
  amountMax: 9999999.99,
  cancelReasonMin: 5,
  cancelReasonMax: 500,
  rehireAheadDays: 90,
  overrideReasonMin: 10,
  overrideReasonMax: 500,
};

// ── enums (mirror backend constants/exit.constants.js) ───────────────────────
export const EXIT_TYPES = ["RESIGNATION", "TERMINATION"];
export const REASON_CATEGORIES = {
  RESIGNATION: ["BETTER_OPPORTUNITY", "PERSONAL", "RELOCATION", "HEALTH", "OTHER"],
  TERMINATION: ["PERFORMANCE", "MISCONDUCT", "REDUNDANCY", "CONTRACT_END", "ABSCONDING", "OTHER"],
};
export const EXIT_STATUSES = ["IN_NOTICE", "EXITED", "COMPLETED", "CANCELLED"];
export const LOAN_HANDLING = ["RECOVER", "WRITE_OFF", "SETTLED"];
export const CHECKLIST_CATEGORIES = ["LOAN", "ASSETS", "FINANCE", "PROJECT", "ADMINISTRATION", "IT", "HR", "OTHER"];
export const CHECKLIST_STATUSES = ["PENDING", "DONE", "NA"];
export const ADJUSTMENT_TYPES = ["EARNING", "DEDUCTION"];
export const CONFIRM_MODES = ["ON_LWD", "IMMEDIATE"];

// ── date helpers ("YYYY-MM-DD", compared as whole days) ──────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

export const toDay = (s) => {
  if (typeof s !== "string" || !DATE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return Math.round(t / DAY_MS);
};
const dayToYmd = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);
export const todayYmd = () => {
  const n = new Date();
  return dayToYmd(Math.round(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY_MS));
};
export const addDays = (ymd, n) => (toDay(ymd) === null ? null : dayToYmd(toDay(ymd) + Number(n || 0)));
export const diffDays = (a, b) => (toDay(a) === null || toDay(b) === null ? null : toDay(a) - toDay(b));

// Same derivations as the backend.
// 30 days of notice starting 2 Oct → last working day 31 Oct.
export const computeLastWorkingDay = (start, noticeDays) =>
  addDays(start, Math.max(Number(noticeDays || 0) - 1, 0));
export const computeRehireAllowedFrom = (lastWorkingDay, coolingDays) =>
  addDays(lastWorkingDay, Number(coolingDays || 0));

// Radio/toggle values arrive as booleans or "true"/"false" strings.
export const isYesNo = (v) => v === true || v === false || v === "true" || v === "false";
export const asBool = (v) => v === true || v === "true";

const isWholeNumberIn = (v, min, max) => {
  if (v === "" || v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!/^-?\d+$/.test(s)) return false;
  const n = Number(s);
  return n >= min && n <= max;
};
const lengthIn = (v, min, max) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length >= min && s.length <= max;
};
// V20 — checked on the raw text: "10.005" and "1e3" are rejected, like the backend.
export const isValidAmount = (v) => {
  if (typeof v !== "number" && typeof v !== "string") return false;
  const s = String(v).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return false;
  const n = Number(s);
  return n > 0 && n <= LIMITS.amountMax;
};

// ── rules ─────────────────────────────────────────────────────────────────────
// `t` from useTranslation (any namespace — keys are fully qualified).
// ctx.outstandingLoan  : amount owed (> 0 → loan handling required, V11)
// ctx.rehireAllowedFrom: "YYYY-MM-DD" (V22 lower bound), optional
// ctx.relaxStart       : true when editing an existing exit whose start date is
//                        unchanged (only needs to be a real date) — like the backend.
// ctx.overrideRequired : true when required checklist items are still open, so
//                        confirming needs the owner's override reason (V28).
// ctx.allowPastLwd     : true for the company owner (may backdate the LWD).
// ctx.originalLwd      : the saved LWD when editing (unchanged → not re-checked).
export const exitRules = (t, ctx = {}) => {
  const m = (key, opts) => t(`exits:validation.${key}`, opts);

  const noticeStartValid = (v) => {
    const day = toDay(v);
    if (day === null) return false;
    if (ctx.relaxStart) return true;
    return Math.abs(day - toDay(todayYmd())) <= LIMITS.noticeStartWindowDays;
  };

  return {
    // V1 (the employee is chosen by the page; this guards a missing value)
    employee_id: { required: m("employeeInvalid") },

    // V2–V4
    exit_type: { validate: (v) => EXIT_TYPES.includes(v) || m("exitType") },
    reason_category: {
      validate: (v, f) => (REASON_CATEGORIES[f.exit_type] || []).includes(v) || m("reasonCategory"),
    },
    reason: { validate: (v) => lengthIn(v, LIMITS.reasonMin, LIMITS.reasonMax) || m("reason") },

    // V5–V8
    notice_start_date: { validate: (v) => noticeStartValid(v) || m("noticeStart") },
    notice_days: { validate: (v) => isWholeNumberIn(v, 0, LIMITS.noticeDaysMax) || m("noticeDays") },
    last_working_day: {
      validate: (v, f) => {
        if (toDay(v) === null) return m("lwdInvalid");
        if (toDay(f.notice_start_date) === null) return true; // V5 reports the start
        const d = diffDays(v, f.notice_start_date);
        if (d < 0) return m("lwdBeforeStart");
        if (d > LIMITS.lwdMaxAfterStartDays) return m("lwdTooFar");
        // V7b — not before today, except for the owner; an unchanged LWD on
        // the edit form is left alone (like the backend).
        if (!ctx.allowPastLwd && v !== ctx.originalLwd && diffDays(v, todayYmd()) < 0) return m("lwdPast");
        return true;
      },
    },
    preferred_last_day: {
      validate: (v, f) => {
        if (v === "" || v === null || v === undefined) return true;
        if (toDay(v) === null) return m("preferredDay");
        if (toDay(f.notice_start_date) !== null && diffDays(v, f.notice_start_date) < 0) return m("preferredDay");
        return true;
      },
    },

    // V9, V10, V12
    allow_leave_during_notice: { validate: (v) => isYesNo(v) || m("yesNo") },
    encash_leave: { validate: (v) => isYesNo(v) || m("yesNo") },
    rehire_eligible: { validate: (v) => isYesNo(v) || m("yesNo") },

    // V11
    loan_handling: {
      validate: (v) =>
        !(Number(ctx.outstandingLoan) > 0) || LOAN_HANDLING.includes(v) || m("loanHandling"),
    },

    // V13
    cooling_period_days: {
      validate: (v, f) =>
        !asBool(f.rehire_eligible) || isWholeNumberIn(v, 0, LIMITS.coolingDaysMax) || m("coolingDays"),
    },

    // V14–V15 (checklist item)
    checklist_status: { validate: (v) => CHECKLIST_STATUSES.includes(v) || m("checklistStatus") },
    checklist_note: {
      validate: (v, f) => {
        const s = typeof v === "string" ? v.trim() : "";
        if (f.status === "NA") {
          if (s.length < LIMITS.naNoteMin) return m("naNoteRequired");
          if (s.length > LIMITS.noteMax) return m("noteTooLong");
          return true;
        }
        return s.length <= LIMITS.noteMax || m("noteTooLong");
      },
    },

    // V16–V17 (checklist item / template row)
    label: { validate: (v) => lengthIn(v, LIMITS.labelMin, LIMITS.labelMax) || m("label") },
    category: { validate: (v) => CHECKLIST_CATEGORIES.includes(v) || m("category") },

    // V18–V20 (settlement adjustment)
    adjustment_type: { validate: (v) => ADJUSTMENT_TYPES.includes(v) || m("adjustmentType") },
    amount: { validate: (v) => isValidAmount(v) || m("amount") },

    // V21
    cancel_reason: {
      validate: (v) => lengthIn(v, LIMITS.cancelReasonMin, LIMITS.cancelReasonMax) || m("cancelReason"),
    },

    // V27–V28 (HR confirmation)
    mode: {
      validate: (v) => CONFIRM_MODES.includes(v) || m("confirmMode"),
    },
    override_reason: {
      validate: (v) => {
        const s = typeof v === "string" ? v.trim() : "";
        if (!s && !ctx.overrideRequired) return true;
        return lengthIn(v, LIMITS.overrideReasonMin, LIMITS.overrideReasonMax) || m("overrideReason");
      },
    },

    // V22
    rehire_date: {
      validate: (v) => {
        if (toDay(v) === null) return m("rehireDateInvalid");
        if (diffDays(v, todayYmd()) > LIMITS.rehireAheadDays) return m("rehireTooFar");
        if (ctx.rehireAllowedFrom && diffDays(v, ctx.rehireAllowedFrom) < 0) {
          return m("rehireTooEarly", { date: ctx.rehireAllowedFrom });
        }
        return true;
      },
    },
    project_id: {
      validate: (v) => v === "" || v === null || v === undefined || /^[1-9]\d*$/.test(String(v)) || m("projectInvalid"),
    },

    // V23–V25 (company settings)
    default_notice_days: { validate: (v) => isWholeNumberIn(v, 0, LIMITS.noticeDaysMax) || m("noticeDays") },
    default_cooling_days: { validate: (v) => isWholeNumberIn(v, 0, LIMITS.coolingDaysMax) || m("coolingDays") },
    yes_no: { validate: (v) => isYesNo(v) || m("yesNo") },
  };
};

// V26 + V16 duplicates for the template editor (whole-list rules).
// Returns { listError, rowErrors: { [index]: message } } — same messages as the
// backend (duplicates are reported on the later row's label, like the server).
export const validateTemplateItems = (t, items = []) => {
  const m = (key) => t(`exits:validation.${key}`);
  const rowErrors = {};
  const seen = new Set();
  items.forEach((it, i) => {
    const key = `${it.category}::${String(it.label || "").trim().toLowerCase()}`;
    if (seen.has(key)) rowErrors[i] = m("itemExists");
    else seen.add(key);
  });
  const listError = items.some((i) => i.is_active !== false) ? null : m("templateEmpty");
  return { listError, rowErrors };
};
