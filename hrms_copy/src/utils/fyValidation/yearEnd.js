// ─────────────────────────────────────────────────────────────────────────────
// Financial Year — year-end leave override rules (LeaveOverrideModal).
// Mirrors fyinder-backend-nodejs src/backend newHrms/leaveYear.service.js
// setOverride EXACTLY: same limits, same order, same messages
// (fiscalYear:validation.* hold the backend's own EN / AR text).
// Change one side → change the other.
//
//   const errors = validateLeaveOverride(t, { carry_days, encash_days, reason }, row);
//   // → { carry_days?, encash_days?, reason? } (empty = valid)
// ─────────────────────────────────────────────────────────────────────────────

export const OVERRIDE_LIMITS = { reasonMin: 10, reasonMax: 500 };

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const twoDecimals = (n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
const num = (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);

// Plain checks → [{ field, key, params }] in the backend's order.
export const leaveOverrideIssues = ({ carry_days, encash_days, reason }, row = {}) => {
  const issues = [];
  const carry = num(carry_days);
  const encash = num(encash_days);
  const checkDays = (field, n) => {
    if (typeof n !== "number" || !Number.isFinite(n)) issues.push({ field, key: "enterDays" });
    else if (n < 0) issues.push({ field, key: "daysNegative" });
    else if (!twoDecimals(n)) issues.push({ field, key: "twoDecimals" });
  };
  checkDays("carry_days", carry);
  checkDays("encash_days", encash);
  const text = typeof reason === "string" ? reason.trim() : "";
  const reasonOk = text.length >= OVERRIDE_LIMITS.reasonMin && text.length <= OVERRIDE_LIMITS.reasonMax;
  if (!reasonOk) issues.push({ field: "reason", key: "overrideReason" });

  const numbersOk = !issues.some((e) => e.field !== "reason");
  if (numbersOk && row && row.left !== undefined && row.left !== null) {
    const left = r2(row.left);
    if (left < 0) {
      issues.push({ field: "carry_days", key: "negativeCarried" });
    } else if (r2(carry + encash) > left) {
      issues.push({ field: "encash_days", key: "overLeft", params: { left } });
    }
    const cap = row.policy && row.policy.allow_carry_forward ? r2(row.policy.max_carry_forward_days) : 0;
    if (carry > cap && !reasonOk) {
      issues.push({ field: "carry_days", key: "overCap", params: { cap } });
    }
  }
  return issues;
};

// → { field: message } (first message per field), translated.
export const validateLeaveOverride = (t, values, row) => {
  const out = {};
  for (const { field, key, params } of leaveOverrideIssues(values, row)) {
    if (!out[field]) out[field] = t(`fiscalYear:validation.${key}`, params || {});
  }
  return out;
};
