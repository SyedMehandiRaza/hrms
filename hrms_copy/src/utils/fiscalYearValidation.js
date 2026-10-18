// ─────────────────────────────────────────────────────────────────────────────
// Financial Year — the FRONTEND half of every FY form's validation.
// Each area mirrors its backend validator exactly (limits, enums, messages);
// the messages live in fiscalYear:validation.* (the backend's EN / AR text).
// Every new FY form imports its rules from here — no ad-hoc rules.
//
//   core    → settings, month locks, reopen, reports
//             (backend utils/newHrms/fiscalYear.validation.js)
//   leave   → leave override, balance adjustment, policy version
//   payroll → salary increments
//   ops     → holiday copy, week-off copy, staffing rates, contract term
// ─────────────────────────────────────────────────────────────────────────────

export * from "./fyValidation/core";
export * from "./fyValidation/ops-time";
export * from "./fyValidation/yearEnd";
export * from "./fyValidation/payroll";
export * from "./fyValidation/leave";
export * from "./fyValidation/misc";
export * from "./fyValidation/encashment";
