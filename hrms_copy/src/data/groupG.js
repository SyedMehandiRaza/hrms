// Static data for group G: employee exits (resignation / termination), exit
// visas and the financial year-end close wizard. Each section keeps a small
// in-memory store so actions (approve, confirm, close …) change what the
// screens show until the page is reloaded. Nothing here talks to a backend.

import { DEPARTMENTS, EMPLOYEES, employeeById, matches, nextId, paginate } from "./common";
import { addDays, computeLastWorkingDay, diffDays, todayYmd } from "../utils/exitValidation";

const clone = (v) => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));
const nowIso = () => new Date().toISOString();
const ADMIN_EMAIL = "ahmed@fyinder.com";
const HR_EMAIL = "fatima.alzahra@fyinder.com";
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ═════════════════════════════════════════════════════════════════════════════
// EXITS
// ═════════════════════════════════════════════════════════════════════════════

let EXIT_SETTINGS = {
  default_notice_days: 30,
  default_cooling_days: 90,
  default_allow_leave_during_notice: false,
  default_encash_leave: true,
  block_loans_during_notice: true,
};

let EXIT_TEMPLATE = [
  { id: 1, category: "LOAN", label: "Outstanding loans settled", is_required: true, is_active: true },
  { id: 2, category: "ASSETS", label: "Laptop and accessories returned", is_required: true, is_active: true },
  { id: 3, category: "ASSETS", label: "Access card and parking tag returned", is_required: true, is_active: true },
  { id: 4, category: "FINANCE", label: "Pending expense claims cleared", is_required: false, is_active: true },
  { id: 5, category: "PROJECT", label: "Project handover completed", is_required: true, is_active: true },
  { id: 6, category: "ADMINISTRATION", label: "Visa and labour card cancellation", is_required: true, is_active: true },
  { id: 7, category: "IT", label: "Email and system access revoked", is_required: true, is_active: true },
  { id: 8, category: "HR", label: "Exit interview", is_required: false, is_active: true },
  { id: 9, category: "OTHER", label: "Company SIM card returned", is_required: false, is_active: false },
];

// One checklist from the active template; `st` maps template id → [status, note].
const checklistFrom = (exitId, st = {}, actionedAt = "2026-10-05T09:30:00.000Z") =>
  EXIT_TEMPLATE.filter((tp) => tp.is_active).map((tp, i) => {
    const [status = "PENDING", note = ""] = st[tp.id] || [];
    return {
      id: exitId * 100 + tp.id,
      category: tp.category,
      label: tp.label,
      is_required: tp.is_required,
      auto: tp.category === "LOAN",
      status,
      note,
      sort_order: i + 1,
      actioned_at: status === "PENDING" ? null : actionedAt,
      actioned_by: status === "PENDING" ? null : { email: HR_EMAIL },
    };
  });

const ALL_DONE = { 1: ["DONE"], 2: ["DONE"], 3: ["DONE"], 4: ["DONE"], 5: ["DONE"], 6: ["DONE"], 7: ["DONE"], 8: ["DONE"] };

const empRef = (id, employment_status) => {
  const e = employeeById(id);
  return { id: e.id, full_name: e.full_name, country_emp_id: e.employee_code, email: e.email, employment_status };
};

const doc = (exitId, n, doc_type, generated_at, extra = {}) => ({
  id: exitId * 10 + n,
  doc_type,
  version: 1,
  generated_at,
  sent_at: null,
  is_final: false,
  url: "#",
  download_url: "#",
  ...extra,
});

const docsFor = (exitId, exitType, generatedAt, extra = {}) => [
  doc(exitId, 1, exitType === "TERMINATION" ? "TERMINATION_LETTER" : "RELIEVING_LETTER", generatedAt, extra),
  doc(exitId, 2, "FNF_STATEMENT", generatedAt, extra),
  doc(exitId, 3, "CLEARANCE_CERTIFICATE", generatedAt, extra),
];

const totalsOf = (lines) => {
  const additions = r2(lines.filter((l) => l.type === "EARNING").reduce((s, l) => s + Number(l.amount), 0));
  const deductions = r2(lines.filter((l) => l.type === "DEDUCTION").reduce((s, l) => s + Number(l.amount), 0));
  return { additions, deductions, net: r2(additions - deductions) };
};

const posted = (lines, loans, payroll) => ({
  posted: true,
  currency: "AED",
  lines,
  totals: totalsOf(lines),
  loans,
  payroll,
});

// The in-notice estimate (nothing posted yet).
const previewOf = ({ dailyRate, leave, loans = [] }) => {
  const rows = leave.map((l) => ({ ...l, amount: r2(l.encashable_days * dailyRate) }));
  const encashable_days = rows.reduce((s, l) => s + l.encashable_days, 0);
  return {
    posted: false,
    currency: "AED",
    preview: {
      currency: "AED",
      has_salary: true,
      daily_rate: dailyRate,
      leave: rows,
      encashable_days,
      encashment_amount: r2(rows.reduce((s, l) => s + l.amount, 0)),
      loans,
      outstanding_loan_total: r2(loans.reduce((s, l) => s + l.outstanding, 0)),
    },
    lines: [],
    payroll: null,
  };
};

const AL = (days, cap = 30) => ({ leave_type_id: 1, leave_name: "Annual Leave", leave_code: "AL", encashable_days: days, cap });
const SL = (days) => ({ leave_type_id: 2, leave_name: "Sick Leave", leave_code: "SL", encashable_days: days, cap: null });

const ev = (id, event_type, created_at, payload = {}, actor = { email: ADMIN_EMAIL }) => ({ id, event_type, created_at, actor, payload });

let EXITS = [
  // 1 — in notice, LWD extended by leave, loan to recover, checklist half done
  {
    id: 1,
    employee: empRef(3, "IN_NOTICE"),
    exit_type: "RESIGNATION",
    reason_category: "BETTER_OPPORTUNITY",
    reason: "Accepted an offer with a regional tech company in Riyadh. Happy to support the handover of the payments module.",
    status: "IN_NOTICE",
    notice: {
      start_date: "2026-10-01",
      days: 30,
      original_last_working_day: "2026-10-30",
      last_working_day: "2026-11-02",
      preferred_last_day: "2026-10-28",
      allow_leave_during_notice: true,
      extended_days: 3,
    },
    settlement_options: { encash_leave: true, loan_handling: "RECOVER" },
    rehire: { eligible: true, cooling_period_days: 90, allowed_from: "2027-01-31" },
    access: { can_login: true },
    confirmation: { confirmed: false, awaiting: false, waiting_for_payroll: false },
    raised_by: { email: HR_EMAIL },
    created_at: "2026-10-01T08:15:00.000Z",
    checklist: checklistFrom(1, { 2: ["DONE", "Dell Latitude 5440 returned to IT store"], 4: ["NA", "No open claims this quarter"], 7: ["DONE"] }),
    settlement: previewOf({
      dailyRate: 400,
      leave: [AL(18), SL(0)],
      loans: [{ id: 12, loan_number: "LN-2026-0012", outstanding: 4500 }],
    }),
    documents: [],
    events: [
      ev(101, "RAISED", "2026-10-01T08:15:00.000Z", {}, { email: HR_EMAIL }),
      ev(102, "CHECKLIST_UPDATED", "2026-10-05T09:30:00.000Z", { label: "Laptop and accessories returned", from: "PENDING", to: "DONE", note: "Dell Latitude 5440 returned to IT store" }, { email: HR_EMAIL }),
      ev(103, "CHECKLIST_UPDATED", "2026-10-05T09:32:00.000Z", { label: "Pending expense claims cleared", from: "PENDING", to: "NA", note: "No open claims this quarter" }, { email: HR_EMAIL }),
      ev(104, "LWD_EXTENDED", "2026-10-08T11:00:00.000Z", { from: "2026-10-30", to: "2026-11-02", days: 3, leave_request_id: 418 }, null),
      ev(105, "TERMS_UPDATED", "2026-10-09T07:45:00.000Z", { changes: { preferred_last_day: { from: null, to: "2026-10-28" } } }),
    ],
  },
  // 2 — in notice, confirmed to end on the LWD, documents generated
  {
    id: 2,
    employee: empRef(6, "IN_NOTICE"),
    exit_type: "RESIGNATION",
    reason_category: "RELOCATION",
    reason: "Relocating back to Manila with family at the end of the year.",
    status: "IN_NOTICE",
    notice: {
      start_date: "2026-10-12",
      days: 35,
      original_last_working_day: "2026-11-15",
      last_working_day: "2026-11-15",
      preferred_last_day: null,
      allow_leave_during_notice: false,
      extended_days: 0,
    },
    settlement_options: { encash_leave: true, loan_handling: "NONE" },
    rehire: { eligible: true, cooling_period_days: 0, allowed_from: "2026-11-15" },
    access: { can_login: true },
    confirmation: { confirmed: true, awaiting: false, waiting_for_payroll: false, mode: "ON_LWD" },
    raised_by: { email: ADMIN_EMAIL },
    created_at: "2026-10-12T06:00:00.000Z",
    checklist: checklistFrom(2, { ...ALL_DONE, 1: ["NA", "No loans on record"], 8: ["PENDING"] }, "2026-10-14T10:00:00.000Z"),
    settlement: previewOf({ dailyRate: 366.67, leave: [AL(20), SL(0)] }),
    documents: docsFor(2, "RESIGNATION", "2026-10-14T10:20:00.000Z"),
    events: [
      ev(201, "RAISED", "2026-10-12T06:00:00.000Z"),
      ev(202, "CONFIRMED", "2026-10-14T10:15:00.000Z", { mode: "ON_LWD" }),
      ev(203, "DOCUMENT_GENERATED", "2026-10-14T10:20:00.000Z", { doc_type: "RELIEVING_LETTER", version: 1 }, null),
      ev(204, "DOCUMENT_GENERATED", "2026-10-14T10:20:00.000Z", { doc_type: "FNF_STATEMENT", version: 1 }, null),
    ],
  },
  // 3 — exited, settlement posted, awaiting confirmation (required items open)
  {
    id: 3,
    employee: empRef(9, "EXITED"),
    exit_type: "TERMINATION",
    reason_category: "PERFORMANCE",
    reason: "Repeated safety violations on the Yas Mall site after two written warnings.",
    status: "EXITED",
    notice: {
      start_date: "2026-09-11",
      days: 30,
      original_last_working_day: "2026-10-10",
      last_working_day: "2026-10-10",
      preferred_last_day: null,
      allow_leave_during_notice: false,
      extended_days: 0,
    },
    settlement_options: { encash_leave: true, loan_handling: "RECOVER" },
    rehire: { eligible: false, cooling_period_days: null, allowed_from: null },
    access: { can_login: false },
    confirmation: { confirmed: false, awaiting: true, waiting_for_payroll: false },
    raised_by: { email: ADMIN_EMAIL },
    created_at: "2026-09-11T05:30:00.000Z",
    exited_at: "2026-10-10T20:00:00.000Z",
    checklist: checklistFrom(3, { 1: ["DONE", "Recovered from final settlement"], 2: ["DONE"], 7: ["DONE"], 8: ["NA", "Employee declined"] }, "2026-10-10T12:00:00.000Z"),
    settlement: posted(
      [
        { kind: "ENCASHMENT", label: "Annual leave encashment", type: "EARNING", amount: 1400.04, days: 12, rate: 116.67, salary_transaction_id: 9001 },
        { kind: "ADJUSTMENT", label: "End-of-service gratuity", type: "EARNING", amount: 2450, salary_transaction_id: 9002 },
        { kind: "LOAN_RECOVERY", label: "Loan LN-2025-0087 recovery", type: "DEDUCTION", amount: 1200, salary_transaction_id: 9003 },
        { kind: "ADJUSTMENT", label: "Damaged safety equipment", type: "DEDUCTION", amount: 350, salary_transaction_id: 9004 },
      ],
      [{ loan_id: 87, loan_number: "LN-2025-0087", action: "RECOVER", amount: 1200 }],
      { year: 2026, month: 10, project_id: 2, run_status: "DRAFT", payslip_net: null, switched_month: false },
    ),
    documents: [],
    events: [
      ev(301, "RAISED", "2026-09-11T05:30:00.000Z"),
      ev(302, "EXITED", "2026-10-10T20:00:00.000Z", {}, null),
      ev(303, "SETTLEMENT_POSTED", "2026-10-10T20:00:00.000Z", {}, null),
      ev(304, "ADJUSTMENT_ADDED", "2026-10-12T08:10:00.000Z", { type: "DEDUCTION", label: "Damaged safety equipment", amount: 350 }),
    ],
  },
  // 4 — exited + confirmed, waiting for the final payroll
  {
    id: 4,
    employee: empRef(5, "EXITED"),
    exit_type: "RESIGNATION",
    reason_category: "PERSONAL",
    reason: "Returning to Cairo to look after family.",
    status: "EXITED",
    notice: {
      start_date: "2026-09-01",
      days: 30,
      original_last_working_day: "2026-09-30",
      last_working_day: "2026-09-30",
      preferred_last_day: null,
      allow_leave_during_notice: true,
      extended_days: 0,
    },
    settlement_options: { encash_leave: true, loan_handling: "NONE" },
    rehire: { eligible: true, cooling_period_days: 180, allowed_from: "2027-03-29" },
    access: { can_login: false },
    confirmation: { confirmed: true, awaiting: false, waiting_for_payroll: true, mode: "ON_LWD" },
    raised_by: { email: HR_EMAIL },
    created_at: "2026-09-01T07:00:00.000Z",
    exited_at: "2026-09-30T20:00:00.000Z",
    checklist: checklistFrom(4, { ...ALL_DONE, 1: ["NA", "No loans on record"] }, "2026-09-28T09:00:00.000Z"),
    settlement: posted(
      [
        { kind: "ENCASHMENT", label: "Annual leave encashment", type: "EARNING", amount: 4999.95, days: 15, rate: 333.33, salary_transaction_id: 9101 },
        { kind: "ADJUSTMENT", label: "End-of-service gratuity", type: "EARNING", amount: 17500, salary_transaction_id: 9102 },
        { kind: "ADJUSTMENT", label: "Unreturned parking card", type: "DEDUCTION", amount: 150, salary_transaction_id: 9103 },
      ],
      [],
      { year: 2026, month: 9, project_id: null, run_status: "PENDING_APPROVAL", payslip_net: 36849.95, switched_month: false },
    ),
    documents: docsFor(4, "RESIGNATION", "2026-09-30T21:00:00.000Z", { sent_at: "2026-10-01T06:00:00.000Z" }),
    events: [
      ev(401, "RAISED", "2026-09-01T07:00:00.000Z", {}, { email: HR_EMAIL }),
      ev(402, "CONFIRMED", "2026-09-28T09:10:00.000Z", { mode: "ON_LWD" }),
      ev(403, "EXITED", "2026-09-30T20:00:00.000Z", {}, null),
      ev(404, "SETTLEMENT_POSTED", "2026-09-30T20:00:00.000Z", {}, null),
      ev(405, "DOCUMENT_SENT", "2026-10-01T06:00:00.000Z", { to: "youssef.nasser@fyinder.com" }),
    ],
  },
  // 5 — completed, rehire-eligible (Rehire button)
  {
    id: 5,
    employee: empRef(11, "EXITED"),
    exit_type: "RESIGNATION",
    reason_category: "HEALTH",
    reason: "Taking a career break for medical treatment.",
    status: "COMPLETED",
    notice: {
      start_date: "2026-08-02",
      days: 30,
      original_last_working_day: "2026-08-31",
      last_working_day: "2026-08-31",
      preferred_last_day: null,
      allow_leave_during_notice: true,
      extended_days: 0,
    },
    settlement_options: { encash_leave: true, loan_handling: "RECOVER" },
    rehire: { eligible: true, cooling_period_days: 30, allowed_from: "2026-09-30" },
    access: { can_login: false },
    confirmation: { confirmed: true, awaiting: false, waiting_for_payroll: false, mode: "ON_LWD" },
    raised_by: { email: HR_EMAIL },
    created_at: "2026-08-02T07:00:00.000Z",
    exited_at: "2026-08-31T20:00:00.000Z",
    completed_at: "2026-09-25T10:00:00.000Z",
    checklist: checklistFrom(5, ALL_DONE, "2026-08-29T09:00:00.000Z"),
    settlement: posted(
      [
        { kind: "ENCASHMENT", label: "Annual leave encashment", type: "EARNING", amount: 3500, days: 10, rate: 350, salary_transaction_id: 9201 },
        { kind: "ADJUSTMENT", label: "End-of-service gratuity", type: "EARNING", amount: 14175, salary_transaction_id: 9202 },
        { kind: "LOAN_RECOVERY", label: "Loan LN-2026-0004 recovery", type: "DEDUCTION", amount: 2000, salary_transaction_id: 9203 },
      ],
      [{ loan_id: 4, loan_number: "LN-2026-0004", action: "RECOVER", amount: 2000 }],
      { year: 2026, month: 8, project_id: null, run_status: "CREDITED", payslip_net: 30675, switched_month: false },
    ),
    documents: docsFor(5, "RESIGNATION", "2026-09-25T10:00:00.000Z", { is_final: true, sent_at: "2026-09-25T11:00:00.000Z" }),
    events: [
      ev(501, "RAISED", "2026-08-02T07:00:00.000Z", {}, { email: HR_EMAIL }),
      ev(502, "CONFIRMED", "2026-08-29T09:10:00.000Z", { mode: "ON_LWD" }),
      ev(503, "EXITED", "2026-08-31T20:00:00.000Z", {}, null),
      ev(504, "COMPLETED", "2026-09-25T10:00:00.000Z", {}, null),
    ],
  },
  // 6 — completed termination, not rehire-eligible, project payroll
  {
    id: 6,
    employee: empRef(10, "EXITED"),
    exit_type: "TERMINATION",
    reason_category: "CONTRACT_END",
    reason: "Fixed-term site contract for the Riyadh Metro maintenance phase ended.",
    status: "COMPLETED",
    notice: {
      start_date: "2026-06-01",
      days: 30,
      original_last_working_day: "2026-06-30",
      last_working_day: "2026-06-30",
      preferred_last_day: null,
      allow_leave_during_notice: false,
      extended_days: 0,
    },
    settlement_options: { encash_leave: true, loan_handling: "NONE" },
    rehire: { eligible: false, cooling_period_days: null, allowed_from: null },
    access: { can_login: false },
    confirmation: { confirmed: true, awaiting: false, waiting_for_payroll: false, mode: "ON_LWD" },
    raised_by: { email: ADMIN_EMAIL },
    created_at: "2026-06-01T05:00:00.000Z",
    exited_at: "2026-06-30T20:00:00.000Z",
    completed_at: "2026-07-28T09:00:00.000Z",
    checklist: checklistFrom(6, { ...ALL_DONE, 1: ["NA", "No loans on record"] }, "2026-06-29T09:00:00.000Z"),
    settlement: posted(
      [
        { kind: "ENCASHMENT", label: "Annual leave encashment", type: "EARNING", amount: 853.36, days: 8, rate: 106.67, salary_transaction_id: 9301 },
        { kind: "ADJUSTMENT", label: "End-of-service gratuity", type: "EARNING", amount: 1120, salary_transaction_id: 9302 },
      ],
      [],
      { year: 2026, month: 7, project_id: 3, run_status: "CREDITED", payslip_net: 6773.36, switched_month: true },
    ),
    documents: docsFor(6, "TERMINATION", "2026-07-28T09:00:00.000Z", { is_final: true, sent_at: "2026-07-28T09:30:00.000Z" }),
    events: [
      ev(601, "RAISED", "2026-06-01T05:00:00.000Z"),
      ev(602, "CONFIRMED", "2026-06-25T09:00:00.000Z", { mode: "ON_LWD" }),
      ev(603, "EXITED", "2026-06-30T20:00:00.000Z", {}, null),
      ev(604, "COMPLETED", "2026-07-28T09:00:00.000Z", {}, null),
    ],
  },
  // 7 — cancelled (the employee stayed)
  {
    id: 7,
    employee: empRef(8, "ACTIVE"),
    exit_type: "RESIGNATION",
    reason_category: "BETTER_OPPORTUNITY",
    reason: "Offer from a competitor in Abu Dhabi.",
    status: "CANCELLED",
    cancel_reason: "Counter-offer accepted — promoted to Senior Sales Executive.",
    notice: {
      start_date: "2026-07-15",
      days: 30,
      original_last_working_day: "2026-08-13",
      last_working_day: "2026-08-13",
      preferred_last_day: null,
      allow_leave_during_notice: false,
      extended_days: 0,
    },
    settlement_options: { encash_leave: true, loan_handling: "NONE" },
    rehire: { eligible: true, cooling_period_days: 90, allowed_from: "2026-11-11" },
    access: { can_login: true },
    confirmation: { confirmed: false, awaiting: false, waiting_for_payroll: false },
    raised_by: { email: HR_EMAIL },
    created_at: "2026-07-15T06:00:00.000Z",
    cancelled_at: "2026-07-22T12:00:00.000Z",
    checklist: checklistFrom(7, { 2: ["DONE"] }, "2026-07-18T09:00:00.000Z"),
    settlement: previewOf({ dailyRate: 283.33, leave: [AL(9), SL(0)] }),
    documents: [],
    events: [
      ev(701, "RAISED", "2026-07-15T06:00:00.000Z", {}, { email: HR_EMAIL }),
      ev(702, "CANCELLED", "2026-07-22T12:00:00.000Z", { reason: "Counter-offer accepted — promoted to Senior Sales Executive." }),
    ],
  },
  // 8 — in notice, last days (amber countdown), nothing to encash
  {
    id: 8,
    employee: empRef(12, "IN_NOTICE"),
    exit_type: "TERMINATION",
    reason_category: "REDUNDANCY",
    reason: "Role consolidated after the Riyadh site office restructuring.",
    status: "IN_NOTICE",
    notice: {
      start_date: "2026-09-22",
      days: 30,
      original_last_working_day: "2026-10-21",
      last_working_day: "2026-10-21",
      preferred_last_day: null,
      allow_leave_during_notice: false,
      extended_days: 0,
    },
    settlement_options: { encash_leave: false, loan_handling: "NONE" },
    rehire: { eligible: true, cooling_period_days: 60, allowed_from: "2026-12-20" },
    access: { can_login: true },
    confirmation: { confirmed: false, awaiting: false, waiting_for_payroll: false },
    raised_by: { email: ADMIN_EMAIL },
    created_at: "2026-09-22T05:00:00.000Z",
    checklist: checklistFrom(8, { 1: ["NA", "No loans on record"], 2: ["DONE"], 3: ["DONE"], 5: ["DONE"], 6: ["DONE"], 7: ["DONE"] }, "2026-10-15T09:00:00.000Z"),
    settlement: previewOf({ dailyRate: 200, leave: [AL(6), SL(0)] }),
    documents: [],
    events: [
      ev(801, "RAISED", "2026-09-22T05:00:00.000Z"),
      ev(802, "CHECKLIST_UPDATED", "2026-10-15T09:00:00.000Z", { label: "Project handover completed", from: "PENDING", to: "DONE" }, { email: HR_EMAIL }),
    ],
  },
];

let eventSeq = 1000;
const pushEvent = (x, event_type, payload = {}, actor = { email: ADMIN_EMAIL }) => {
  eventSeq += 1;
  x.events.push({ id: eventSeq, event_type, created_at: nowIso(), actor, payload });
};

const closedItem = (i) => i.status === "DONE" || i.status === "NA";

// The detail as the screens read it (live countdown + checklist progress).
const toDetail = (x) => {
  const d = clone(x);
  d.notice.days_left = d.status === "IN_NOTICE" ? Math.max(diffDays(d.notice.last_working_day, todayYmd()) ?? 0, 0) : null;
  const req = d.checklist.filter((i) => i.is_required);
  d.checklist_progress = {
    required_total: req.length,
    required_closed: req.filter(closedItem).length,
    total: d.checklist.length,
    closed: d.checklist.filter(closedItem).length,
  };
  return d;
};

const findExit = (id) => EXITS.find((x) => x.id === Number(id));

export const getExit = (id) => {
  const x = findExit(id);
  return x ? toDetail(x) : null;
};

// GET /exits — status tab, search, type, reason, LWD month, awaiting filter.
export const listExits = (params = {}) => {
  const rows = EXITS.map(toDetail).filter((x) => {
    if (params.status && x.status !== params.status) return false;
    if (params.exit_type && x.exit_type !== params.exit_type) return false;
    if (params.reason_category && x.reason_category !== params.reason_category) return false;
    if (params.lwd_month && !String(x.notice.last_working_day).startsWith(params.lwd_month)) return false;
    if (params.awaiting_confirmation && !x.confirmation?.awaiting) return false;
    if (params.search && !matches(x.employee, params.search, ["full_name", "country_emp_id"])) return false;
    return true;
  });
  rows.sort((a, b) => String(a.notice.last_working_day).localeCompare(String(b.notice.last_working_day)));
  const p = paginate(rows, params.page || 1, params.limit || 10);
  return { data: p.rows, meta: { total: p.total, totalPages: p.totalPages } };
};

export const exitCounts = (statuses) =>
  Object.fromEntries(statuses.map((s) => [s, EXITS.filter((x) => x.status === s).length]));

// The logged-in employee's open exit (NoticeBanner) — the static employee is on notice.
export const getMyExit = () => {
  const x = EXITS.find((e) => e.employee.id === 12 && e.status === "IN_NOTICE");
  if (!x) return null;
  const d = toDetail(x);
  return {
    id: d.id,
    status: d.status,
    last_working_day: d.notice.last_working_day,
    days_left: d.notice.days_left,
    allow_leave_during_notice: d.notice.allow_leave_during_notice,
  };
};

export const setChecklistItem = (id, itemId, { status, note }) => {
  const x = findExit(id);
  const item = x.checklist.find((i) => i.id === Number(itemId));
  const from = item.status;
  item.status = status;
  item.note = note || "";
  item.actioned_at = status === "PENDING" ? null : nowIso();
  item.actioned_by = status === "PENDING" ? null : { email: ADMIN_EMAIL };
  pushEvent(x, "CHECKLIST_UPDATED", { label: item.label, from, to: status, note: item.note || undefined });
  return toDetail(x);
};

export const addChecklistItem = (id, { category, label, is_required }) => {
  const x = findExit(id);
  x.checklist.push({
    id: nextId(x.checklist),
    category,
    label,
    is_required: !!is_required,
    auto: false,
    status: "PENDING",
    note: "",
    sort_order: x.checklist.length + 1,
    actioned_at: null,
    actioned_by: null,
  });
  pushEvent(x, "ITEM_ADDED", { label, category });
  return toDetail(x);
};

export const getSettlement = (id) => clone(findExit(id)?.settlement || null);

export const addAdjustment = (id, { type, label, amount }) => {
  const x = findExit(id);
  const s = x.settlement;
  s.lines.push({ kind: "ADJUSTMENT", label, type, amount: r2(amount), salary_transaction_id: 9900 + s.lines.length });
  if (s.posted) s.totals = totalsOf(s.lines);
  pushEvent(x, "ADJUSTMENT_ADDED", { type, label, amount: r2(amount) });
  return clone(s);
};

export const updateExitTerms = (id, patch) => {
  const x = findExit(id);
  const before = {
    notice_start_date: x.notice.start_date,
    notice_days: x.notice.days,
    last_working_day: x.notice.last_working_day,
    preferred_last_day: x.notice.preferred_last_day,
    allow_leave_during_notice: x.notice.allow_leave_during_notice,
    encash_leave: x.settlement_options.encash_leave,
    loan_handling: x.settlement_options.loan_handling,
    rehire_eligible: x.rehire.eligible,
    cooling_period_days: x.rehire.cooling_period_days,
  };
  const changes = {};
  Object.entries(patch).forEach(([k, v]) => {
    changes[k] = { from: before[k] ?? null, to: v };
  });
  if ("notice_start_date" in patch) x.notice.start_date = patch.notice_start_date;
  if ("notice_days" in patch) x.notice.days = patch.notice_days;
  if ("last_working_day" in patch) {
    x.notice.last_working_day = patch.last_working_day;
    x.notice.original_last_working_day = patch.last_working_day;
    x.notice.extended_days = 0;
  }
  if ("preferred_last_day" in patch) x.notice.preferred_last_day = patch.preferred_last_day;
  if ("allow_leave_during_notice" in patch) x.notice.allow_leave_during_notice = patch.allow_leave_during_notice;
  if ("encash_leave" in patch) x.settlement_options.encash_leave = patch.encash_leave;
  if ("loan_handling" in patch) x.settlement_options.loan_handling = patch.loan_handling;
  if ("rehire_eligible" in patch) x.rehire.eligible = patch.rehire_eligible;
  if ("cooling_period_days" in patch) x.rehire.cooling_period_days = patch.cooling_period_days;
  x.rehire.allowed_from = x.rehire.eligible ? addDays(x.notice.last_working_day, x.rehire.cooling_period_days || 0) : null;
  pushEvent(x, "TERMS_UPDATED", { changes });
  return toDetail(x);
};

export const cancelExit = (id, cancelReason) => {
  const x = findExit(id);
  x.status = "CANCELLED";
  x.cancel_reason = cancelReason;
  x.cancelled_at = nowIso();
  x.employee.employment_status = "ACTIVE";
  x.access.can_login = true;
  pushEvent(x, "CANCELLED", { reason: cancelReason });
  return toDetail(x);
};

export const rehireExit = (id, { rehire_date }) => {
  const x = findExit(id);
  x.employee.employment_status = "ACTIVE";
  x.access.can_login = true;
  pushEvent(x, "REHIRED", { rehire_date });
  return toDetail(x);
};

export const confirmExit = (id, { mode, override_reason }) => {
  const x = findExit(id);
  const open = x.checklist.filter((i) => i.is_required && !closedItem(i));
  x.confirmation = { ...x.confirmation, confirmed: true, awaiting: false, mode };
  if (x.status === "IN_NOTICE" && mode === "IMMEDIATE") {
    const today = todayYmd();
    pushEvent(x, "RELIEVED_EARLY", { from: x.notice.last_working_day, to: today });
    x.notice.last_working_day = today;
    x.status = "EXITED";
    x.exited_at = nowIso();
    x.employee.employment_status = "EXITED";
    x.access.can_login = false;
  }
  if (x.status === "EXITED") x.confirmation.waiting_for_payroll = true;
  pushEvent(
    x,
    open.length ? "CONFIRMED_WITH_OVERRIDE" : "CONFIRMED",
    { mode, ...(open.length ? { open_items: open.map((i) => ({ id: i.id, label: i.label })), reason: override_reason } : {}) },
  );
  const at = nowIso();
  x.documents = docsFor(x.id, x.exit_type, at);
  x.documents.forEach((d) => pushEvent(x, "DOCUMENT_GENERATED", { doc_type: d.doc_type, version: 1 }, null));
  return toDetail(x);
};

export const regenerateExitDocument = (id, type) => {
  const x = findExit(id);
  const d = x.documents.find((dd) => dd.doc_type === type);
  if (d) {
    d.version += 1;
    d.generated_at = nowIso();
    pushEvent(x, "DOCUMENT_GENERATED", { doc_type: type, version: d.version }, null);
  }
  return toDetail(x);
};

export const sendExitDocuments = (id) => {
  const x = findExit(id);
  const at = nowIso();
  x.documents.forEach((d) => {
    d.sent_at = at;
  });
  pushEvent(x, "DOCUMENT_SENT", { to: x.employee.email });
  return toDetail(x);
};

export const getExitSettings = () => clone(EXIT_SETTINGS);
export const updateExitSettings = (payload) => {
  EXIT_SETTINGS = { ...EXIT_SETTINGS, ...payload };
  return clone(EXIT_SETTINGS);
};

export const getExitTemplate = () => clone(EXIT_TEMPLATE);
export const replaceExitTemplate = (items) => {
  let seq = EXIT_TEMPLATE.reduce((m, r) => Math.max(m, r.id), 0);
  EXIT_TEMPLATE = items.map((it) => ({ ...it, id: it.id || (seq += 1) }));
  return clone(EXIT_TEMPLATE);
};

// Raise-exit wizard preview: defaults, settlement estimate, handover warnings.
const LOANS_BY_EMPLOYEE = {
  3: [{ id: 12, loan_number: "LN-2026-0012", outstanding: 4500 }],
  7: [
    { id: 31, loan_number: "LN-2026-0031", outstanding: 6000 },
    { id: 35, loan_number: "LN-2026-0035", outstanding: 1250 },
  ],
};

export const previewExit = (employeeId) => {
  const e = employeeById(employeeId);
  const start = todayYmd();
  const dailyRate = r2(Number(e.basic_salary || 0) / 30);
  const leave = [AL(Math.min(14 + (e.id % 6) * 2, 30)), SL(0)].map((l) => ({ ...l, amount: r2(l.encashable_days * dailyRate) }));
  const loans = LOANS_BY_EMPLOYEE[e.id] || [];
  const isManager = [1, 2, 7].includes(e.id);
  return {
    employee: { id: e.id, full_name: e.full_name, country_emp_id: e.employee_code },
    defaults: {
      notice_start_date: start,
      notice_days: EXIT_SETTINGS.default_notice_days,
      last_working_day: computeLastWorkingDay(start, EXIT_SETTINGS.default_notice_days),
      allow_leave_during_notice: EXIT_SETTINGS.default_allow_leave_during_notice,
      encash_leave: EXIT_SETTINGS.default_encash_leave,
      rehire_eligible: true,
      cooling_period_days: EXIT_SETTINGS.default_cooling_days,
    },
    settlement: {
      currency: e.currency || "AED",
      has_salary: true,
      daily_rate: dailyRate,
      leave,
      encashable_days: leave.reduce((s, l) => s + l.encashable_days, 0),
      encashment_amount: r2(leave.reduce((s, l) => s + l.amount, 0)),
      loans,
      outstanding_loan_total: r2(loans.reduce((s, l) => s + l.outstanding, 0)),
    },
    warnings: isManager
      ? {
          approval_groups: [{ id: 1, name: "Leave approvers — " + (e.department_name || "Operations") }, { id: 4, name: "Overtime approvers" }],
          pending_approvals: 3,
          projects: [{ id: 1, name: "Marina Tower Fit-out" }],
          deployments: [],
        }
      : {
          approval_groups: [],
          pending_approvals: 0,
          projects: e.id % 2 ? [{ id: 2, name: "Yas Mall Expansion" }] : [],
          deployments: e.employment_type === "CONTRACT" ? [{ id: 7, name: "Gulf Manpower Services — Yas Mall" }] : [],
        },
  };
};

export const raiseExit = (payload) => {
  const pv = previewExit(payload.employee_id);
  const e = employeeById(payload.employee_id);
  const id = nextId(EXITS);
  const x = {
    id,
    employee: empRef(e.id, "IN_NOTICE"),
    exit_type: payload.exit_type,
    reason_category: payload.reason_category,
    reason: payload.reason,
    status: "IN_NOTICE",
    notice: {
      start_date: payload.notice_start_date,
      days: payload.notice_days,
      original_last_working_day: payload.last_working_day,
      last_working_day: payload.last_working_day,
      preferred_last_day: payload.preferred_last_day || null,
      allow_leave_during_notice: payload.allow_leave_during_notice,
      extended_days: 0,
    },
    settlement_options: { encash_leave: payload.encash_leave, loan_handling: payload.loan_handling || "NONE" },
    rehire: {
      eligible: payload.rehire_eligible,
      cooling_period_days: payload.rehire_eligible ? payload.cooling_period_days : null,
      allowed_from: payload.rehire_eligible ? addDays(payload.last_working_day, payload.cooling_period_days || 0) : null,
    },
    access: { can_login: true },
    confirmation: { confirmed: false, awaiting: false, waiting_for_payroll: false },
    raised_by: { email: ADMIN_EMAIL },
    created_at: nowIso(),
    checklist: checklistFrom(id),
    settlement: { posted: false, currency: pv.settlement.currency, preview: pv.settlement, lines: [], payroll: null },
    documents: [],
    events: [],
  };
  pushEvent(x, "RAISED");
  EXITS = [...EXITS, x];
  return toDetail(x);
};

// ═════════════════════════════════════════════════════════════════════════════
// EXIT VISAS
// ═════════════════════════════════════════════════════════════════════════════

const visaEmp = (id) => {
  const e = employeeById(id);
  return { id: e.id, name: e.full_name, code: e.employee_code };
};

let VISAS = [
  {
    id: 1, employee: visaEmp(3), visa_type: "SINGLE_EXIT", status: "PENDING_APPROVAL",
    requested_from: "2026-12-20", requested_to: "2027-01-05", final_exit_date: null,
    valid_from: null, valid_until: null, visa_number: null, max_exits: 1, exits_used: 0,
    reason: "Annual vacation to Kochi for the holidays.", rejection_reason: null,
    approval: { current_level: 1, total_levels: 2 }, trips: [],
  },
  {
    id: 2, employee: visaEmp(7), visa_type: "MULTIPLE_EXIT", status: "PENDING_APPROVAL",
    requested_from: "2026-11-01", requested_to: "2027-04-30", final_exit_date: null,
    valid_from: null, valid_until: null, visa_number: null, max_exits: 4, exits_used: 0,
    reason: "Regular site visits to the Bahrain project office.", rejection_reason: null,
    approval: { current_level: 2, total_levels: 2 }, trips: [],
  },
  {
    id: 3, employee: visaEmp(9), visa_type: "FINAL_EXIT", status: "APPROVED",
    requested_from: null, requested_to: null, final_exit_date: "2026-10-25",
    valid_from: null, valid_until: null, visa_number: null, max_exits: 1, exits_used: 0,
    reason: "Final exit after end of employment.", rejection_reason: null,
    approval: { current_level: 2, total_levels: 2 }, trips: [],
  },
  {
    id: 4, employee: visaEmp(5), visa_type: "MULTIPLE_EXIT", status: "ACTIVE",
    requested_from: "2026-06-01", requested_to: "2026-12-31", final_exit_date: null,
    valid_from: "2026-06-01", valid_until: "2026-12-31", visa_number: "MEV-2026-118403", max_exits: 3, exits_used: 1,
    reason: "Family visits to Cairo.", rejection_reason: null,
    approval: { current_level: 2, total_levels: 2 },
    trips: [
      { id: 41, visa_id: 4, departure_date: "2026-07-10", expected_return_date: "2026-07-24", actual_return_date: "2026-07-23", status: "RETURNED", notes: "Eid holiday" },
      { id: 42, visa_id: 4, departure_date: "2026-10-20", expected_return_date: "2026-10-27", actual_return_date: null, status: "PLANNED", notes: "Family event" },
      { id: 43, visa_id: 4, departure_date: "2026-12-22", expected_return_date: "2027-01-02", actual_return_date: null, status: "PENDING_APPROVAL", notes: "Year-end vacation" },
    ],
  },
  {
    id: 5, employee: visaEmp(12), visa_type: "SINGLE_EXIT", status: "ACTIVE",
    requested_from: "2026-09-15", requested_to: "2026-11-30", final_exit_date: null,
    valid_from: "2026-09-15", valid_until: "2026-11-30", visa_number: "SEV-2026-220917", max_exits: 1, exits_used: 0,
    reason: "Visit to Dhaka.", rejection_reason: null,
    approval: { current_level: 1, total_levels: 1 },
    trips: [{ id: 51, visa_id: 5, departure_date: "2026-10-14", expected_return_date: "2026-10-28", actual_return_date: null, status: "DEPARTED", notes: "" }],
  },
  {
    id: 6, employee: visaEmp(10), visa_type: "SINGLE_EXIT", status: "EXHAUSTED",
    requested_from: "2026-03-01", requested_to: "2026-05-31", final_exit_date: null,
    valid_from: "2026-03-01", valid_until: "2026-05-31", visa_number: "SEV-2026-031144", max_exits: 1, exits_used: 1,
    reason: "Ramadan leave.", rejection_reason: null,
    approval: { current_level: 1, total_levels: 1 },
    trips: [{ id: 61, visa_id: 6, departure_date: "2026-03-18", expected_return_date: "2026-04-05", actual_return_date: "2026-04-04", status: "RETURNED", notes: "" }],
  },
  {
    id: 7, employee: visaEmp(8), visa_type: "SINGLE_EXIT", status: "REJECTED",
    requested_from: "2026-08-10", requested_to: "2026-08-30", final_exit_date: null,
    valid_from: null, valid_until: null, visa_number: null, max_exits: 1, exits_used: 0,
    reason: "Wedding in Hyderabad.", rejection_reason: "Overlaps the Q3 sales close — please re-apply for September.",
    approval: { current_level: 1, total_levels: 2 }, trips: [],
  },
  {
    id: 8, employee: visaEmp(4), visa_type: "MULTIPLE_EXIT", status: "EXPIRED",
    requested_from: "2025-10-01", requested_to: "2026-03-31", final_exit_date: null,
    valid_from: "2025-10-01", valid_until: "2026-03-31", visa_number: "MEV-2025-097761", max_exits: 2, exits_used: 1,
    reason: "Family visits to Lahore.", rejection_reason: null,
    approval: { current_level: 2, total_levels: 2 },
    trips: [{ id: 81, visa_id: 8, departure_date: "2025-12-24", expected_return_date: "2026-01-04", actual_return_date: "2026-01-04", status: "RETURNED", notes: "" }],
  },
  {
    id: 9, employee: visaEmp(6), visa_type: "SINGLE_EXIT", status: "CANCELLED",
    requested_from: "2026-05-01", requested_to: "2026-05-15", final_exit_date: null,
    valid_from: null, valid_until: null, visa_number: null, max_exits: 1, exits_used: 0,
    reason: "Trip postponed.", rejection_reason: null,
    approval: { current_level: 1, total_levels: 2 }, trips: [],
  },
];

const findVisa = (id) => VISAS.find((v) => v.id === Number(id));

// Employees for the "apply on behalf" picker.
export const visaEmployees = (search = "") =>
  EMPLOYEES.filter((e) => e.status === "ACTIVE")
    .filter((e) => matches(e, search, ["full_name", "employee_code"]))
    .map((e) => ({ id: e.id, full_name: e.full_name, country_emp_id: e.employee_code }));

export const listVisas = (q = {}) => {
  const rows = VISAS.filter(
    (v) =>
      (!q.status || v.status === q.status) &&
      (!q.visa_type || v.visa_type === q.visa_type) &&
      (!q.search || matches(v.employee, q.search, ["name", "code"]) || matches(v, q.search, ["visa_number"])),
  );
  const p = paginate(rows, q.page || 1, q.limit || 10);
  return { data: clone(p.rows), total: p.total, total_pages: p.totalPages };
};

export const visaInbox = () => clone(VISAS.filter((v) => v.status === "PENDING_APPROVAL"));

export const tripInbox = () =>
  VISAS.flatMap((v) =>
    v.trips
      .filter((tr) => tr.status === "PENDING_APPROVAL")
      .map((tr) => ({ ...clone(tr), visa_id: v.id, visa_type: v.visa_type, employee: clone(v.employee) })),
  );

export const actVisa = (id, action, comments = "") => {
  const v = findVisa(id);
  if (action === "APPROVE") {
    v.status = "APPROVED";
    if (v.approval) v.approval.current_level = v.approval.total_levels;
  } else {
    v.status = "REJECTED";
    v.rejection_reason = comments;
  }
  return clone(v);
};

export const issueVisa = (id, payload) => {
  const v = findVisa(id);
  Object.assign(v, payload, { status: "ACTIVE" });
  if (v.visa_type === "FINAL_EXIT") v.max_exits = 1;
  return clone(v);
};

export const cancelVisa = (id) => {
  const v = findVisa(id);
  v.status = "CANCELLED";
  return clone(v);
};

export const addTrip = (id, payload) => {
  const v = findVisa(id);
  v.trips.push({
    id: Number(`${v.id}${v.trips.length + 1}`) + 1000,
    visa_id: v.id,
    departure_date: payload.departure_date,
    expected_return_date: payload.expected_return_date || null,
    actual_return_date: null,
    status: "PENDING_APPROVAL",
    notes: payload.notes || "",
  });
  return clone(v);
};

const setTrip = (id, tripId, patch) => {
  const v = findVisa(id);
  const tr = v.trips.find((x) => x.id === Number(tripId));
  Object.assign(tr, patch);
  return v;
};

export const approveTrip = (id, tripId) => clone(setTrip(id, tripId, { status: "PLANNED" }));
export const rejectTrip = (id, tripId) => clone(setTrip(id, tripId, { status: "REJECTED" }));
export const cancelTrip = (id, tripId) => clone(setTrip(id, tripId, { status: "CANCELLED" }));
export const returnTrip = (id, tripId, { actual_return_date }) => {
  const v = setTrip(id, tripId, { status: "RETURNED", actual_return_date });
  v.exits_used = Math.min(v.max_exits, v.exits_used + 1);
  if (v.exits_used >= v.max_exits) v.status = "EXHAUSTED";
  return clone(v);
};

export const applyVisaForEmployee = (payload) => {
  const v = {
    id: nextId(VISAS),
    employee: visaEmp(payload.employee_id),
    visa_type: payload.visa_type,
    status: "PENDING_APPROVAL",
    requested_from: payload.requested_from || null,
    requested_to: payload.requested_to || null,
    final_exit_date: payload.final_exit_date || null,
    valid_from: null,
    valid_until: null,
    visa_number: null,
    max_exits: payload.max_exits || 1,
    exits_used: 0,
    reason: payload.reason || "",
    rejection_reason: null,
    approval: { current_level: 1, total_levels: 2 },
    trips: [],
  };
  VISAS = [v, ...VISAS];
  return clone(v);
};

// ═════════════════════════════════════════════════════════════════════════════
// FINANCIAL YEAR-END CLOSE
// ═════════════════════════════════════════════════════════════════════════════

const STEP_KEYS = ["READINESS", "LEAVE", "PAYROLL", "BILLING", "SETUP", "CLOSE"];
const steps = (status) => STEP_KEYS.map((step) => ({ step, status }));
const monthsOf = (yearKey) =>
  Array.from({ length: 12 }, (_, i) => ({ year: yearKey, month: i + 1, value: `${yearKey}-${String(i + 1).padStart(2, "0")}` }));

export const FY_SETTINGS = { fy_start_month: 1, pending_on_close: "BLOCK", timezone: "Asia/Dubai" };

const YEARS = {
  2025: {
    id: 1,
    year_key: 2025,
    label: "FY 2025",
    start_date: "2025-01-01",
    end_date: "2025-12-31",
    status: "CLOSED",
    is_locked: false,
    closed_at: "2026-01-20T10:30:00.000Z",
    reopen_until: "2026-12-31T19:59:00.000Z",
    can_reopen: true,
    steps: steps("DONE"),
    months: monthsOf(2025),
    totals: {
      payroll: { payslips: 136, gross: 1987450, deductions: 84320.5, net: 1903129.5 },
      leave: { carried: 214.5, encashed: 61, lapsed: 38 },
    },
    leaveClosed: true,
    reportsGenerated: true,
  },
  2026: {
    id: 2,
    year_key: 2026,
    label: "FY 2026",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    status: "OPEN",
    is_locked: false,
    closed_at: null,
    reopen_until: null,
    can_reopen: false,
    steps: steps("PENDING"),
    months: monthsOf(2026),
    totals: null,
    leaveClosed: false,
    reportsGenerated: false,
  },
};

const yearDetail = (y) => {
  if (!y) return null;
  const rest = clone(y);
  delete rest.leaveClosed;
  delete rest.reportsGenerated;
  return rest;
};

export const getFiscalYear = (yearKey) => yearDetail(YEARS[Number(yearKey)]);
export const getFiscalSettings = () => clone(FY_SETTINGS);

export const startYearReview = (yearKey) => {
  const y = YEARS[Number(yearKey)];
  y.status = "CLOSING";
  y.steps.find((s) => s.step === "READINESS").status = "IN_PROGRESS";
  return yearDetail(y);
};

export const setYearStep = (yearKey, step, status = "DONE") => {
  const y = YEARS[Number(yearKey)];
  y.steps.find((s) => s.step === step).status = status;
  if (y.status === "OPEN") y.status = "CLOSING";
  return yearDetail(y);
};

// Readiness checks — live for the leave close and the annual reports.
export const getReadiness = (yearKey) => {
  const y = YEARS[Number(yearKey)];
  const pendingVisas = VISAS.filter((v) => v.status === "PENDING_APPROVAL").length;
  const inNotice = EXITS.filter((x) => x.status === "IN_NOTICE").length;
  const unconfirmed = EXITS.filter((x) => x.status === "EXITED" && !x.confirmation?.confirmed).length;
  const items = [
    { key: "year_ended", status: "WARN", count: 1, end_date: y.end_date },
    { key: "pending_leave", status: "WARN", count: 3 },
    { key: "pending_overtime", status: "OK", count: 0 },
    { key: "pending_corrections", status: "OK", count: 0 },
    { key: "pending_exit_visas", status: pendingVisas ? "WARN" : "OK", count: pendingVisas },
    { key: "pending_loans", status: "OK", count: 0 },
    { key: "pending_leave_encashments", status: "OK", count: 0, note: "NOT_USED" },
    { key: "payroll_not_generated", status: "WARN", count: 2, months: [`${y.year_key}-11`, `${y.year_key}-12`] },
    { key: "payroll_not_credited", status: "WARN", count: 2, months: [`${y.year_key}-09`, `${y.year_key}-10`] },
    { key: "staffing_bills_open", status: "WARN", count: 3 },
    { key: "exits_in_notice", status: inNotice ? "WARN" : "OK", count: inNotice },
    { key: "exits_unconfirmed", status: unconfirmed ? "WARN" : "OK", count: unconfirmed },
    { key: "next_year_holidays_missing", status: "WARN", count: 1 },
    // blocks the close until the leave is closed (a skipped leave step only warns)
    {
      key: "leave_not_closed",
      status: y.leaveClosed ? "OK" : y.steps.find((s) => s.step === "LEAVE")?.status === "SKIPPED" ? "WARN" : "BLOCK",
      count: y.leaveClosed ? 0 : 1,
    },
    { key: "annual_reports_missing", status: y.reportsGenerated ? "OK" : "WARN", count: y.reportsGenerated ? 0 : 1 },
  ];
  return {
    items,
    block: items.filter((i) => i.status === "BLOCK").length,
    warn: items.filter((i) => i.status === "WARN").length,
  };
};

// Leave balances closing with the year.
export const YEAR_END_LEAVE_TYPES = [
  { id: 1, leave_name: "Annual Leave" },
  { id: 2, leave_name: "Sick Leave" },
];
export const YEAR_END_DEPARTMENTS = DEPARTMENTS.map((d) => ({ id: d.id, name: d.name }));

const LEFT_DAYS = { 1: 22, 2: 14.5, 3: 16, 4: 9, 5: 11, 6: 18.5, 7: 25, 8: 7, 9: 4, 10: 3.5, 11: 0, 12: 12 };
const policyOf = (typeId) =>
  typeId === 1 ? { allow_carry_forward: true, max_carry_forward_days: 10, max_encash_days: 5 } : { allow_carry_forward: false, max_carry_forward_days: 0, max_encash_days: 0 };

const LEAVE_BALANCES = EMPLOYEES.filter((e) => e.status === "ACTIVE").flatMap((e) =>
  YEAR_END_LEAVE_TYPES.map((lt) => {
    const left = lt.id === 1 ? LEFT_DAYS[e.id] ?? 10 : (e.id % 3) * 2 + 1;
    const policy = policyOf(lt.id);
    return {
      balance_id: e.id * 10 + lt.id,
      employee_id: e.id,
      department_id: e.department_id,
      employee: { id: e.id, full_name: e.full_name, country_emp_id: e.employee_code },
      leave_type: { id: lt.id, name: lt.leave_name },
      left,
      daily_rate: r2(Number(e.basic_salary || 0) / 30),
      policy,
      override: e.id === 7 && lt.id === 1 ? { carry_days: 15, encash_days: 5, reason: "Approved by CEO — Riyadh go-live delayed his leave" } : null,
    };
  }),
);

const splitOf = (b) => {
  const carry = b.override ? b.override.carry_days : b.policy.allow_carry_forward ? Math.min(b.left, b.policy.max_carry_forward_days) : 0;
  const encash = b.override ? b.override.encash_days : Math.min(r2(b.left - carry), b.policy.max_encash_days);
  const lapse = r2(b.left - carry - encash);
  return {
    balance_id: b.balance_id,
    employee: b.employee,
    leave_type: b.leave_type,
    policy: b.policy,
    left: b.left,
    carry,
    encash,
    lapse,
    encash_amount: r2(encash * b.daily_rate),
    carry_expires_on: carry > 0 ? "2027-03-31" : null,
    override: b.override,
  };
};

export const getLeavePreview = (yearKey, query = {}) => {
  const rows = LEAVE_BALANCES.filter(
    (b) =>
      (!query.leave_type_id || b.leave_type.id === Number(query.leave_type_id)) &&
      (!query.department_id || b.department_id === Number(query.department_id)) &&
      matches(b.employee, query.search, ["full_name", "country_emp_id"]),
  ).map(splitOf);
  const sum = (k) => r2(rows.reduce((s, r) => s + Number(r[k] || 0), 0));
  const p = paginate(rows, query.page || 1, query.limit || 25);
  return {
    data: clone(p.rows),
    meta: { page: p.page, limit: p.limit, total: p.total, totalPages: p.totalPages },
    totals: {
      employees: new Set(rows.map((r) => r.employee.id)).size,
      left: sum("left"),
      carry: sum("carry"),
      encash: sum("encash"),
      lapse: sum("lapse"),
      encash_amount: sum("encash_amount"),
    },
  };
};

export const setLeaveOverride = (yearKey, balanceId, { carry_days, encash_days, reason }) => {
  const b = LEAVE_BALANCES.find((x) => x.balance_id === Number(balanceId));
  b.override = { carry_days, encash_days, reason };
  return clone(splitOf(b));
};

export const closeYearLeave = (yearKey) => {
  const y = YEARS[Number(yearKey)];
  y.leaveClosed = true;
  y.steps.find((s) => s.step === "LEAVE").status = "DONE";
  return yearDetail(y);
};

// Payroll runs of a year (company-wide, one per month) — not REJECTED.
export const getYearPayrollRuns = (yearKey) => {
  const k = Number(yearKey);
  const statusOf = (m) => {
    if (k < 2026) return "CREDITED";
    if (m <= 8) return "CREDITED";
    if (m === 9) return "APPROVED";
    if (m === 10) return "DRAFT";
    return null;
  };
  return monthsOf(k)
    .map((m) => ({ period_year: m.year, period_month: m.month, status: statusOf(m.month), total_net: r2(148500 + m.month * 1375.25) }))
    .filter((r) => r.status);
};

// Staffing companies' bills of a year.
const COMPANIES = [
  { id: 1, name: "Gulf Manpower Services" },
  { id: 2, name: "Al Noor Technical Staffing" },
  { id: 3, name: "Desert Star Contracting" },
];
export const getYearStaffingBills = (yearKey) => {
  const k = Number(yearKey);
  const st = (m, c) => {
    if (k < 2026) return "PAID";
    if (m <= 7) return "PAID";
    if (m === 8) return c === 3 ? "APPROVED" : "PAID";
    if (m === 9) return c === 2 ? "PENDING_APPROVAL" : "APPROVED";
    return "DRAFT";
  };
  const last = k < 2026 ? 12 : 10;
  return COMPANIES.flatMap((c) =>
    Array.from({ length: c.id === 3 ? last - 4 : last }, (_, i) => ({
      id: c.id * 100 + i + 1,
      staffing_company: c,
      status: st(i + 1 + (c.id === 3 ? 4 : 0), c.id),
      total_amount: r2(42000 + c.id * 8350.5 + i * 610),
      currency: "AED",
    })),
  );
};

// Year documents (statements + annual reports).
let docSeq = 500;
const YEAR_DOCS = {
  2025: [
    { id: 401, doc_type: "LOAN_STATEMENT", staffing_company_id: null, generated_at: "2026-01-18T08:00:00.000Z", version: 1, pdf_download_url: "#", csv_download_url: "#" },
    { id: 402, doc_type: "STAFFING_STATEMENT", staffing_company_id: 1, generated_at: "2026-01-18T08:02:00.000Z", version: 2, pdf_download_url: "#", csv_download_url: "#" },
    { id: 403, doc_type: "STAFFING_STATEMENT", staffing_company_id: 2, generated_at: "2026-01-18T08:02:00.000Z", version: 1, pdf_download_url: "#", csv_download_url: null },
  ],
  2026: [
    { id: 404, doc_type: "LOAN_STATEMENT", staffing_company_id: null, generated_at: "2026-10-02T07:30:00.000Z", version: 1, pdf_download_url: "#", csv_download_url: "#" },
  ],
};

export const listYearDocuments = (yearKey, types = []) =>
  clone((YEAR_DOCS[Number(yearKey)] || []).filter((d) => !types.length || types.includes(d.doc_type)));

// Generates reports at once and answers with a finished job.
export const generateYearReports = (yearKey, payload = {}) => {
  const k = Number(yearKey);
  const types = payload.types || ["ANNUAL_PAY_STATEMENT", "SALARY_REGISTER", "LEAVE_SUMMARY"];
  const list = YEAR_DOCS[k] || (YEAR_DOCS[k] = []);
  const at = nowIso();
  let made = 0;
  types.forEach((type) => {
    const owners = type === "STAFFING_STATEMENT" ? COMPANIES.map((c) => c.id) : [null];
    owners.forEach((owner) => {
      const prev = list.find((d) => d.doc_type === type && d.staffing_company_id === owner);
      if (prev) {
        prev.version += 1;
        prev.generated_at = at;
      } else {
        docSeq += 1;
        list.push({ id: docSeq, doc_type: type, staffing_company_id: owner, generated_at: at, version: 1, pdf_download_url: "#", csv_download_url: "#" });
      }
      made += 1;
    });
  });
  if (!payload.types && YEARS[k]) YEARS[k].reportsGenerated = true;
  return { job_id: `job-${k}-${Date.now()}`, status: "DONE", done: made * 12, failed: 0, total: made * 12, progress: 100 };
};

export const closeFiscalYear = (yearKey) => {
  const y = YEARS[Number(yearKey)];
  const runs = getYearPayrollRuns(yearKey);
  const gross = r2(runs.reduce((s, r) => s + r.total_net, 0) * 1.045);
  const net = r2(runs.reduce((s, r) => s + r.total_net, 0));
  y.status = "CLOSED";
  y.closed_at = nowIso();
  y.reopen_until = new Date(Date.now() + 30 * 86400000).toISOString();
  y.can_reopen = true;
  y.steps.find((s) => s.step === "CLOSE").status = "DONE";
  y.totals = {
    payroll: { payslips: runs.length * 12, gross, deductions: r2(gross - net), net },
    leave: { carried: 96.5, encashed: 40, lapsed: 52.5 },
  };
  return yearDetail(y);
};

export const reopenFiscalYear = (yearKey) => {
  const y = YEARS[Number(yearKey)];
  y.status = "CLOSING";
  y.is_locked = false;
  y.closed_at = null;
  y.reopen_until = null;
  y.can_reopen = false;
  y.steps.find((s) => s.step === "CLOSE").status = "PENDING";
  return yearDetail(y);
};

// Month locks (MANUAL rows + the payroll-credited auto locks).
let lockSeq = 100;
const LOCKS = {
  2025: [
    ...monthsOf(2025).map((m) => ({ id: m.month, period_year: 2025, period_month: m.month, module: "ALL", source: "PAYROLL_CREDITED", unlocked: false })),
    { id: 20, period_year: 2025, period_month: 12, module: "ALL", source: "MANUAL", reason: "Year-end close — books frozen" },
  ],
  2026: [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((m) => ({ id: 30 + m, period_year: 2026, period_month: m, module: "ALL", source: "PAYROLL_CREDITED", unlocked: m === 3 })),
    { id: 41, period_year: 2026, period_month: 2, module: "ATTENDANCE", source: "MANUAL", reason: "Biometric data reconciled with the site supervisors" },
    { id: 42, period_year: 2026, period_month: 9, module: "PAYROLL", source: "MANUAL", reason: "Payroll under audit review by Finance" },
  ],
};

export const listMonthLocks = (yearKey) => clone(LOCKS[Number(yearKey)] || []);

export const lockMonth = (yearKey, { period_year, period_month, module, reason }) => {
  const list = LOCKS[Number(yearKey)] || (LOCKS[Number(yearKey)] = []);
  lockSeq += 1;
  list.push({ id: lockSeq, period_year, period_month, module, reason, source: "MANUAL" });
  return listMonthLocks(yearKey);
};

export const unlockMonth = (yearKey, { period_year, period_month, module, source }) => {
  const k = Number(yearKey);
  const list = LOCKS[k] || [];
  const same = (l) => l.period_year === period_year && l.period_month === period_month;
  if (source === "PAYROLL_CREDITED") {
    list.filter((l) => same(l) && l.source === "PAYROLL_CREDITED").forEach((l) => {
      l.unlocked = true;
    });
  } else {
    LOCKS[k] = list.filter((l) => !(same(l) && l.source !== "PAYROLL_CREDITED" && l.module === module));
  }
  return listMonthLocks(k);
};
