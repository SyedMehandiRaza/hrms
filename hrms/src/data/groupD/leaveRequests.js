// Static leave-request data (admin dashboard, View-All, review page, My Leave
// Requests, cancel-approved modal). Rows follow the backend list shape
// (leave_type as a name string, levels_summary, can_act …); LR_detailOf()
// expands a row into the GET /leave-requests/:id detail shape.
import { EMPLOYEES } from "../common.js";

// "Today" for the static build — matches the company-timezone date the app shows.
export const LR_TODAY = "2026-10-17";

// The employee whose own requests appear on My Leave Requests when the session
// user carries no employee_id (the admin panel's "My Requests").
export const LR_MY_EMPLOYEE_ID = 4;

export const LR_LEAVE_TYPES = {
  "Annual Leave": { leave_name: "Annual Leave", leave_code: "AL", is_paid: true },
  "Sick Leave": { leave_name: "Sick Leave", leave_code: "SL", is_paid: true },
  "Unpaid Leave": { leave_name: "Unpaid Leave", leave_code: "UL", is_paid: false },
  "Hajj Leave": { leave_name: "Hajj Leave", leave_code: "HL", is_paid: true },
  "Maternity Leave": { leave_name: "Maternity Leave", leave_code: "ML", is_paid: true },
};

// Balance shown in the review sidebar, per leave type (null → "no balance").
const BALANCES = {
  "Annual Leave": { available_balance: "18.00", consumed_balance: "12.00", total_allocated: "30.00" },
  "Sick Leave": { available_balance: "11.00", consumed_balance: "4.00", total_allocated: "15.00" },
  "Unpaid Leave": null,
  "Hajj Leave": { available_balance: "0.00", consumed_balance: "15.00", total_allocated: "15.00" },
  "Maternity Leave": { available_balance: "0.00", consumed_balance: "60.00", total_allocated: "60.00" },
};

const emp = (id) => EMPLOYEES.find((e) => e.id === id);

// Level-1 approver = the employee's department head; level 2 = HR Manager.
const HR_MANAGER = emp(2);
const level1Approver = (employee) =>
  emp(employee.department?.head_id && employee.department.head_id !== employee.id ? employee.department.head_id : 1);

// stage → per-level log statuses + approval header.
//   L1        waiting on level 1      (final PENDING)
//   L2        level 1 done, waiting 2 (final IN_PROGRESS)
//   APPROVED  both levels approved
//   REJECTED  rejected at level 1, level 2 skipped
const STAGES = {
  L1: { logs: ["PENDING", "PENDING"], current_level: 1, final_status: "PENDING" },
  L2: { logs: ["APPROVED", "PENDING"], current_level: 2, final_status: "IN_PROGRESS" },
  APPROVED: { logs: ["APPROVED", "APPROVED"], current_level: 2, final_status: "APPROVED" },
  REJECTED: { logs: ["REJECTED", "SKIPPED"], current_level: 1, final_status: "REJECTED" },
};

const buildLevelsSummary = (logs) =>
  logs.map((l) => ({
    level_no: l.level_no,
    total: 1,
    approved: l.status === "APPROVED" ? 1 : 0,
    pending: l.status === "PENDING" ? 1 : 0,
  }));

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let logSeq = 100;

const request = ({
  id,
  employee_id,
  leave_type,
  from_date,
  to_date,
  total_days,
  status,
  stage,
  reason,
  applied_at,
  half = null, // FIRST_HALF | SECOND_HALF for a single half-day
  viewer = "L2", // the admin viewer's level: "L1" | "L2" | null (not an approver)
  attachments = [],
  cancellation_reason = null,
  reject_reason = null,
}) => {
  const employee = emp(employee_id);
  const st = STAGES[stage];
  const approvers = [level1Approver(employee), HR_MANAGER];
  const logs = st.logs.map((s, i) => ({
    id: ++logSeq,
    level_no: i + 1,
    is_current_level: i + 1 === st.current_level,
    approver_name: approvers[i].full_name,
    status: s,
    comments: s === "REJECTED" ? reject_reason : s === "APPROVED" ? "Approved." : null,
    acted_at: s === "APPROVED" || s === "REJECTED" ? `${applied_at}T10:30:00.000Z` : null,
  }));
  const myLevel = viewer === "L1" ? 1 : viewer === "L2" ? 2 : null;
  const myLog = myLevel ? logs[myLevel - 1] : null;
  const actionable = ["PENDING", "IN_PROGRESS"].includes(st.final_status);
  const can_act = !!(actionable && myLog && myLog.status === "PENDING" && myLog.level_no === st.current_level);
  return {
    id,
    employee_id,
    employee_name: employee.full_name,
    country_emp_id: employee.employee_code,
    profile_url: null,
    approval_request_id: 5000 + id,
    request_code: `LR-2026-${String(id).padStart(4, "0")}`,
    from_date,
    to_date,
    total_days,
    paid_days: LR_LEAVE_TYPES[leave_type].is_paid ? total_days : 0,
    unpaid_days: LR_LEAVE_TYPES[leave_type].is_paid ? 0 : total_days,
    reason,
    status,
    applied_at: `${applied_at}T08:15:00.000Z`,
    reject_reason,
    cancellation_reason,
    leave_type,
    half_day_session: half,
    attachments,
    // approval metadata (list shape)
    final_status: st.final_status,
    current_level: st.current_level,
    total_levels: 2,
    levels_summary: buildLevelsSummary(logs),
    is_approver: !!myLog,
    my_level: myLevel,
    can_act,
    // kept for the detail expansion
    _logs: logs,
  };
};

export const LR_REQUESTS = [
  request({ id: 1, employee_id: 3, leave_type: "Annual Leave", from_date: "2026-10-15", to_date: "2026-10-21", total_days: 5, status: "APPROVED", stage: "APPROVED", applied_at: "2026-09-28", reason: "Family visit to Kochi for Diwali celebrations." }),
  request({ id: 2, employee_id: 6, leave_type: "Sick Leave", from_date: "2026-10-16", to_date: "2026-10-17", total_days: 2, status: "APPROVED", stage: "APPROVED", applied_at: "2026-10-16", reason: "Viral fever, doctor advised two days of rest.", attachments: [{ id: 1, file_name: "medical-certificate.pdf", file_url: "#", file_type: "application/pdf", created_at: "2026-10-16T07:40:00.000Z" }] }),
  request({ id: 3, employee_id: 8, leave_type: "Maternity Leave", from_date: "2026-09-01", to_date: "2026-11-29", total_days: 60, status: "APPROVED", stage: "APPROVED", applied_at: "2026-07-20", reason: "Maternity leave as per UAE Labour Law.", attachments: [{ id: 2, file_name: "hospital-letter.pdf", file_url: "#", file_type: "application/pdf", created_at: "2026-07-20T09:00:00.000Z" }] }),
  request({ id: 4, employee_id: 5, leave_type: "Annual Leave", from_date: "2026-10-19", to_date: "2026-10-20", total_days: 2, status: "APPROVED", stage: "APPROVED", applied_at: "2026-10-05", reason: "Renewing family residence visas in Cairo." }),
  request({ id: 5, employee_id: 9, leave_type: "Annual Leave", from_date: "2026-11-02", to_date: "2026-11-27", total_days: 20, status: "PENDING", stage: "L2", applied_at: "2026-10-10", reason: "Annual home leave to Lahore — flight booked for 1 November." }),
  request({ id: 6, employee_id: 10, leave_type: "Sick Leave", from_date: "2026-10-12", to_date: "2026-10-12", total_days: 0.5, half: "FIRST_HALF", status: "PENDING", stage: "L2", applied_at: "2026-10-12", reason: "Dental appointment in the morning." }),
  request({ id: 7, employee_id: 7, leave_type: "Hajj Leave", from_date: "2026-05-20", to_date: "2026-06-03", total_days: 15, status: "APPROVED", stage: "APPROVED", applied_at: "2026-03-15", reason: "Performing Hajj this year with my family." }),
  request({ id: 8, employee_id: 4, leave_type: "Unpaid Leave", from_date: "2026-12-20", to_date: "2026-12-31", total_days: 9, status: "PENDING", stage: "L1", applied_at: "2026-10-14", reason: "Extended trip to Karachi for my sister's wedding." }),
  request({ id: 9, employee_id: 12, leave_type: "Annual Leave", from_date: "2026-12-24", to_date: "2026-12-28", total_days: 3, status: "PENDING", stage: "L1", viewer: null, applied_at: "2026-10-15", reason: "Year-end holiday in Muscat." }),
  request({ id: 10, employee_id: 1, leave_type: "Sick Leave", from_date: "2026-10-22", to_date: "2026-10-22", total_days: 0.5, half: "SECOND_HALF", status: "PENDING", stage: "L1", viewer: "L1", applied_at: "2026-10-16", reason: "Follow-up physiotherapy session in the afternoon." }),
  request({ id: 11, employee_id: 11, leave_type: "Sick Leave", from_date: "2026-08-10", to_date: "2026-08-11", total_days: 2, status: "REJECTED", stage: "REJECTED", applied_at: "2026-08-12", reason: "Migraine.", reject_reason: "Medical certificate not provided within 48 hours." }),
  request({ id: 12, employee_id: 1, leave_type: "Annual Leave", from_date: "2026-07-06", to_date: "2026-07-17", total_days: 10, status: "CANCELLED", stage: "APPROVED", applied_at: "2026-06-01", reason: "Summer vacation in Amman.", cancellation_reason: "Client go-live moved into July; trip postponed." }),
  request({ id: 13, employee_id: 2, leave_type: "Annual Leave", from_date: "2026-04-13", to_date: "2026-04-16", total_days: 4, status: "APPROVED", stage: "APPROVED", applied_at: "2026-03-30", reason: "Eid Al Fitr extension." }),
  request({ id: 14, employee_id: 3, leave_type: "Sick Leave", from_date: "2026-03-03", to_date: "2026-03-03", total_days: 1, status: "REJECTED", stage: "REJECTED", applied_at: "2026-03-05", reason: "Felt unwell.", reject_reason: "Applied after the sprint review he attended that day." }),
  request({ id: 15, employee_id: 4, leave_type: "Sick Leave", from_date: "2026-02-09", to_date: "2026-02-10", total_days: 2, status: "APPROVED", stage: "APPROVED", applied_at: "2026-02-09", reason: "Food poisoning — clinic visit." }),
  request({ id: 16, employee_id: 4, leave_type: "Annual Leave", from_date: "2026-06-14", to_date: "2026-06-25", total_days: 10, status: "APPROVED", stage: "APPROVED", applied_at: "2026-05-18", reason: "Eid Al Adha with family in Lahore." }),
  request({ id: 17, employee_id: 4, leave_type: "Annual Leave", from_date: "2026-11-16", to_date: "2026-11-18", total_days: 3, status: "PENDING", stage: "L1", applied_at: "2026-10-13", reason: "Moving to a new apartment in Al Nahda." }),
  request({ id: 18, employee_id: 4, leave_type: "Sick Leave", from_date: "2026-09-07", to_date: "2026-09-07", total_days: 0.5, half: "FIRST_HALF", status: "REJECTED", stage: "REJECTED", applied_at: "2026-09-08", reason: "Blood test appointment.", reject_reason: "Site inspection scheduled that morning." }),
  request({ id: 19, employee_id: 4, leave_type: "Unpaid Leave", from_date: "2026-08-03", to_date: "2026-08-04", total_days: 2, status: "CANCELLED", stage: "APPROVED", applied_at: "2026-07-21", reason: "Personal errands.", cancellation_reason: "No longer needed." }),
];

// Per-day breakdown for the detail view (weekends Sat/Sun not counted).
const leaveDaysOf = (row) => {
  const out = [];
  for (let d = row.from_date; d <= row.to_date && out.length < 120; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const session = row.half_day_session || "FULL_DAY";
    out.push({
      leave_date: d,
      session_type: session,
      leave_value: session === "FULL_DAY" ? "1.00" : "0.50",
      is_weekly_off: weekend,
      is_holiday: false,
      holiday_name: null,
      is_counted: !weekend,
      is_paid: LR_LEAVE_TYPES[row.leave_type].is_paid,
    });
  }
  return out;
};

// GET /leave-requests/:id shape (leave_type is an object here, plus the
// approval block with per-member logs and the employee's current balance).
export const LR_detailOf = (row) => {
  if (!row) return null;
  const days = leaveDaysOf(row);
  const { _logs, ...rest } = row;
  return {
    ...rest,
    leave_type: LR_LEAVE_TYPES[row.leave_type],
    leave_policy: { policy_name: `${row.leave_type} Policy`, yearly_quota: BALANCES[row.leave_type]?.total_allocated ?? "0.00" },
    leave_days: days,
    approval: {
      id: row.approval_request_id,
      request_code: `APR-${row.request_code}`,
      final_status: row.final_status,
      current_level: row.current_level,
      total_levels: row.total_levels,
      requested_at: row.applied_at,
      completed_at: ["APPROVED", "REJECTED"].includes(row.final_status) ? row.applied_at : null,
      logs: _logs,
    },
    current_balance: BALANCES[row.leave_type],
    summary: {
      total_requested_days: Number(row.total_days),
      working_days_count: days.filter((d) => d.is_counted).length,
      weekly_off_days_count: days.filter((d) => d.is_weekly_off).length,
      holiday_days_count: 0,
      paid_days: Number(row.paid_days),
      unpaid_days: Number(row.unpaid_days),
    },
  };
};

// Apply an approval action to a row the way the backend would: approve at the
// last level → APPROVED, approve below it → next level, reject → REJECTED.
export const LR_applyAction = (row, action) => {
  const logs = row._logs.map((l) => ({ ...l }));
  const cur = logs.find((l) => l.level_no === row.current_level);
  let { current_level, status } = row;
  let final_status;
  if (action === "REJECT") {
    if (cur) cur.status = "REJECTED";
    logs.forEach((l) => {
      if (l.level_no > current_level) l.status = "SKIPPED";
    });
    final_status = "REJECTED";
    status = "REJECTED";
  } else {
    if (cur) cur.status = "APPROVED";
    if (current_level < row.total_levels) {
      current_level += 1;
      final_status = "IN_PROGRESS";
    } else {
      final_status = "APPROVED";
      status = "APPROVED";
    }
  }
  logs.forEach((l) => {
    l.is_current_level = l.level_no === current_level;
  });
  const myLog = row.my_level ? logs[row.my_level - 1] : null;
  const actionable = ["PENDING", "IN_PROGRESS"].includes(final_status);
  return {
    ...row,
    status,
    final_status,
    current_level,
    levels_summary: buildLevelsSummary(logs),
    can_act: !!(actionable && myLog && myLog.status === "PENDING" && myLog.level_no === current_level),
    _logs: logs,
  };
};

// Keep the shared list in step with an action so the other leave screens see it
// after navigation (in-memory only; a reload restores the samples).
export const LR_save = (row) => {
  const i = LR_REQUESTS.findIndex((r) => r.id === row.id);
  if (i >= 0) LR_REQUESTS[i] = row;
  else LR_REQUESTS.unshift(row);
  return row;
};

export const LR_remove = (id) => {
  const i = LR_REQUESTS.findIndex((r) => r.id === Number(id));
  if (i >= 0) LR_REQUESTS.splice(i, 1);
};

export const LR_cancel = (row, reason) => ({ ...row, status: "CANCELLED", cancellation_reason: reason });

// Company leave dashboard summary (GET /leave-requests/summary shape).
export const LR_summaryOf = (rows, today = LR_TODAY) => {
  const total = rows.length;
  const byType = {};
  rows.forEach((r) => {
    byType[r.leave_type] = (byType[r.leave_type] || 0) + 1;
  });
  const in3 = addDays(today, 3);
  return {
    total_requests: total,
    pending: rows.filter((r) => r.status === "PENDING").length,
    approved: rows.filter((r) => r.status === "APPROVED").length,
    rejected: rows.filter((r) => r.status === "REJECTED").length,
    on_leave_today: rows.filter((r) => r.status === "APPROVED" && r.from_date <= today && r.to_date >= today).length,
    distribution: Object.entries(byType)
      .map(([leave_type, count]) => ({ leave_type, count, pct: total ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count),
    upcoming: rows
      .filter((r) => r.status === "APPROVED" && r.from_date >= today && r.from_date <= in3)
      .sort((a, b) => (a.from_date < b.from_date ? -1 : 1))
      .map((r) => ({
        employee_name: r.employee_name,
        profile_url: r.profile_url,
        leave_type: r.leave_type,
        from_date: r.from_date,
        to_date: r.to_date,
        total_days: r.total_days,
        status: r.status,
      })),
  };
};

// Newest first, like the backend list default.
export const LR_sortNewest = (rows) =>
  rows.slice().sort((a, b) => (a.applied_at < b.applied_at ? 1 : a.applied_at > b.applied_at ? -1 : b.id - a.id));
