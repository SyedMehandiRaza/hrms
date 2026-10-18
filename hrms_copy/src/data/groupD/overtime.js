// Static overtime requests for the UI-only build (admin list, my requests,
// bulk batches, detail drawer). Row shape mirrors the backend's
// listOvertimeRequestsService → enrichWithApproval output.
import { EMPLOYEES, PROJECTS, employeeById } from "../common.js";

// Projects as the HRMS API returns them (project_name, not name).
export const OT_PROJECTS = PROJECTS.map((p) => ({ ...p, project_name: p.name }));

const projectName = (id) => OT_PROJECTS.find((p) => p.id === Number(id))?.project_name ?? null;

// Employees for the "select employees" step: project assignments + main project.
const ASSIGN = {
  1: [4], 2: [4], 3: [1, 4], 4: [2], 5: [3], 6: [1], 7: [3], 8: [2], 9: [2], 10: [1], 11: [3], 12: [1, 2],
};
export const OT_EMPLOYEES = EMPLOYEES.filter((e) => e.status === "ACTIVE").map((e) => ({
  ...e,
  profile_url: null,
  main_project_id: ASSIGN[e.id]?.[0] ?? null,
  projects: (ASSIGN[e.id] || []).map((pid) => ({ id: pid, project_name: projectName(pid) })),
}));

// levels_summary for a request: [{ level_no, approved, pending, total }].
const buildLevels = (total, current, status) =>
  Array.from({ length: total }, (_, i) => {
    const level_no = i + 1;
    if (status === "APPROVED" || level_no < current) return { level_no, approved: 1, pending: 0, total: 1 };
    if (status === "REJECTED" && level_no === current) return { level_no, approved: 0, pending: 0, total: 1 };
    return { level_no, approved: 0, pending: 1, total: 1 };
  });

export const OT_hoursBetween = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.round(((eh * 60 + em - (sh * 60 + sm)) / 60) * 100) / 100;
};

const req = (id, employee_id, project_id, work_date, start_time, end_time, reason, status, { level = 1, total = 2, can_act = true, batch_id = null, created_at } = {}) => {
  const emp = employeeById(employee_id);
  const current_level = status === "APPROVED" ? total : level;
  return {
    id,
    employee_id,
    project_id,
    project_name: projectName(project_id),
    batch_id,
    work_date,
    start_time,
    end_time,
    overtime_hours: OT_hoursBetween(start_time, end_time),
    reason,
    status,
    attachment_url: null,
    created_at: created_at || `${work_date}T20:15:00.000Z`,
    employee_name: emp.full_name,
    employee_code: emp.employee_code,
    profile_url: null,
    current_level,
    total_levels: total,
    final_status: status,
    can_act: status === "PENDING" ? can_act : false,
    levels_summary: buildLevels(total, current_level, status),
  };
};

const BATCH_A = "b7e41c09-2f6d-4a1e-9c33-5d8e0a17f2b4";
const BATCH_B = "4c2a9e71-80d3-4b5f-a6e2-19f7c3d05e88";
const BATCH_C = "e91f03d6-7a4b-4c28-b5d1-63a0f8e2c917";

// Mutable in-memory store so the list, create and bulk screens see each
// other's changes while the app stays open.
export const OT_REQUESTS = [
  req(1, 12, 1, "2026-10-14", "18:00", "21:30", "Tower B slab pour ran past shift end", "PENDING", { level: 1 }),
  req(2, 3, 1, "2026-10-12", "17:30", "20:00", "Client walkthrough prep for Marina Tower fit-out", "PENDING", { level: 2 }),
  req(3, 7, 3, "2026-10-09", "16:00", "22:00", "Emergency track signalling repair at Olaya station", "PENDING", { level: 2, can_act: false }),
  req(4, 6, 1, "2026-10-05", "18:00", "20:30", "Release hotfix for site access system", "APPROVED"),
  req(5, 12, 2, "2026-09-28", "17:00", "19:00", "Material delivery delayed at Yas Mall gate 4", "APPROVED"),
  req(6, 5, 3, "2026-09-30", "17:00", "21:00", "Month-end closing and vendor reconciliation", "APPROVED", { total: 1 }),
  req(7, 8, 2, "2026-09-22", "18:30", "20:30", "Tender submission for Aldar retail package", "REJECTED", { level: 1 }),
  req(8, 12, 1, "2026-09-15", "18:00", "22:00", "Night shift cover for MEP inspection", "REJECTED", { level: 2 }),
  req(9, 4, 4, "2026-08-27", "17:00", "19:30", "Payroll cut-off and WPS file preparation", "APPROVED", { total: 1 }),
  req(10, 12, 1, "2026-08-18", "18:00", "20:00", "Snag list closure before handover", "PENDING", { level: 1, can_act: false }),
  req(11, 9, 2, "2026-07-30", "18:00", "21:00", "Ceiling works catch-up on level 3", "APPROVED"),

  // Batch A — pending, Marina Tower night works.
  req(12, 9, 1, "2026-10-15", "19:00", "23:00", "Night concrete pour for podium level, crane window only after 7 PM", "PENDING", { batch_id: BATCH_A }),
  req(13, 10, 1, "2026-10-15", "19:00", "23:00", "Night concrete pour for podium level, crane window only after 7 PM", "PENDING", { batch_id: BATCH_A }),
  req(14, 12, 1, "2026-10-15", "19:00", "23:00", "Night concrete pour for podium level, crane window only after 7 PM", "PENDING", { batch_id: BATCH_A }),
  req(15, 3, 1, "2026-10-15", "19:00", "23:00", "Night concrete pour for podium level, crane window only after 7 PM", "APPROVED", { batch_id: BATCH_A }),

  // Batch B — approved, Riyadh Metro shutdown.
  req(16, 7, 3, "2026-09-19", "20:00", "23:30", "Planned weekend shutdown maintenance on Line 2", "APPROVED", { batch_id: BATCH_B }),
  req(17, 5, 3, "2026-09-19", "20:00", "23:30", "Planned weekend shutdown maintenance on Line 2", "APPROVED", { batch_id: BATCH_B }),
  req(18, 12, 3, "2026-09-19", "20:00", "23:30", "Planned weekend shutdown maintenance on Line 2", "APPROVED", { batch_id: BATCH_B }),

  // Batch C — rejected, Yas Mall.
  req(19, 8, 2, "2026-08-08", "18:00", "20:00", "Weekend promo launch support", "REJECTED", { batch_id: BATCH_C }),
  req(20, 9, 2, "2026-08-08", "18:00", "20:00", "Weekend promo launch support", "REJECTED", { batch_id: BATCH_C }),
];

export const OT_saveRequests = (rows) => {
  OT_REQUESTS.splice(0, OT_REQUESTS.length, ...rows);
};

export const OT_nextId = () => OT_REQUESTS.reduce((m, r) => Math.max(m, r.id), 0) + 1;

// Build a fresh PENDING request (level 1 of 2) the way the backend returns it.
export const OT_buildRequest = (id, { employee_id, project_id, work_date, start_time, end_time, reason, batch_id = null }) =>
  req(id, Number(employee_id), project_id ? Number(project_id) : null, work_date, start_time, end_time, reason || "", "PENDING", {
    level: 1,
    batch_id,
    created_at: new Date().toISOString(),
  });

export const OT_newBatchId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

// Approve at the current level: next level (waiting on someone else) or final.
export const OT_approve = (row) => {
  if (row.current_level < row.total_levels) {
    const current_level = row.current_level + 1;
    return { ...row, current_level, can_act: false, levels_summary: buildLevels(row.total_levels, current_level, "PENDING") };
  }
  return {
    ...row,
    status: "APPROVED",
    final_status: "APPROVED",
    can_act: false,
    levels_summary: buildLevels(row.total_levels, row.total_levels, "APPROVED"),
  };
};

export const OT_reject = (row, reason) => ({
  ...row,
  status: "REJECTED",
  final_status: "REJECTED",
  rejection_reason: reason,
  can_act: false,
  levels_summary: buildLevels(row.total_levels, row.current_level, "REJECTED"),
});

// Hour totals for the admin stat cards (backend summarizeOvertime).
export const OT_summary = (rows) => {
  const sum = (s) => Math.round(rows.filter((r) => !s || r.status === s).reduce((a, r) => a + Number(r.overtime_hours || 0), 0) * 100) / 100;
  return { total: sum(), approved: sum("APPROVED"), rejected: sum("REJECTED") };
};
