// Static data for the approval groups / routing screens (UI-only build).
// Shapes mirror the backend: GET /approval-groups rows + GET /approval-groups/:id
// (levels[].members[]), GET /rbac/modules ({ module }), GET /approval-assignments.
import { EMPLOYEES, PROJECTS, nextId } from "../common.js";

// Approver pickers read full_name + country_emp_id.
export const APPR_EMPLOYEES = EMPLOYEES.filter((e) => e.status === "ACTIVE").map((e) => ({
  ...e,
  country_emp_id: e.employee_code,
}));

// Project pickers read project_name / project_code.
export const APPR_PROJECTS = PROJECTS.map((p) => ({
  ...p,
  project_name: p.name,
  project_code: p.code,
}));

// Employees assigned to each project (for the "In project" tag + project-scope rule).
const PROJECT_MEMBERS = {
  1: [1, 3, 6, 9, 10],
  2: [2, 4, 9, 12],
  3: [7, 10, 12],
  4: [1, 3, 5],
};

export const APPR_projectEmployees = (projectId) =>
  (PROJECT_MEMBERS[Number(projectId)] || [])
    .map((id) => APPR_EMPLOYEES.find((e) => e.id === id))
    .filter(Boolean);

// RBAC modules feeding the "Module" dropdown.
export const APPR_MODULES = [
  { module: "LEAVE" },
  { module: "OVERTIME" },
  { module: "CORRECTION" },
  { module: "EXIT_VISA" },
  { module: "PAYROLL" },
  { module: "LOAN" },
  { module: "ENCASHMENT" },
];

const fullName = (id) => EMPLOYEES.find((e) => e.id === Number(id))?.full_name || null;

let memberSeq = 100;

// Flat members payload -> group with levels[] (as GET /approval-groups/:id returns).
export const APPR_buildGroup = (base, members = []) => {
  const byLevel = new Map();
  members.forEach((m) => {
    const lvl = Number(m.level_no);
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push({
      id: m.id ?? ++memberSeq,
      employee_id: Number(m.employee_id),
      full_name: fullName(m.employee_id),
      is_mandatory: !!m.is_mandatory,
      can_skip: !!m.can_skip,
      is_active: m.is_active !== false,
    });
  });
  const levels = [...byLevel.keys()]
    .sort((a, b) => a - b)
    .map((level_no) => ({ level_no, members: byLevel.get(level_no) }));
  const activeLevels = levels.filter((l) => l.members.some((m) => m.is_active));
  return { ...base, levels, total_levels: activeLevels.length };
};

const g = (base, members) =>
  APPR_buildGroup(
    { scope: "GLOBAL", project_id: null, description: null, is_active: true, ...base },
    members.map(([employee_id, level_no, is_mandatory = true, can_skip = false], i) => ({
      id: base.id * 10 + i,
      employee_id,
      level_no,
      is_mandatory,
      can_skip,
    })),
  );

// In-memory list shared by the list page and the detail page.
export const APPR_GROUPS = [
  g({ id: 1, group_name: "Leave Approval - Head Office", group_code: "LV-HO", module_key: "LEAVE", description: "Line manager then HR sign-off for all head office leave requests.", created_at: "2026-02-03T09:00:00Z" },
    [[3, 1], [2, 2], [1, 3, false, true]]),
  g({ id: 2, group_name: "Overtime - Marina Tower", group_code: "OT-MRN", module_key: "OVERTIME", scope: "PROJECT", project_id: 1, description: "Site supervisor approves, project manager confirms.", created_at: "2026-03-11T09:00:00Z" },
    [[6, 1], [1, 2]]),
  g({ id: 3, group_name: "Attendance Corrections", group_code: "COR-ALL", module_key: "CORRECTION", created_at: "2026-04-02T09:00:00Z" },
    [[4, 1]]),
  g({ id: 4, group_name: "Riyadh Site Leave", group_code: "LV-RYD", module_key: "LEAVE", scope: "PROJECT", project_id: 3, description: "Leave routing for Riyadh Metro maintenance crew.", created_at: "2026-05-19T09:00:00Z" },
    [[7, 1], [12, 1, false, true], [2, 2]]),
  g({ id: 5, group_name: "Salary & Payroll Sign-off", group_code: "PAY-FIN", module_key: "PAYROLL", description: "Finance review followed by HR and management approval.", created_at: "2026-06-07T09:00:00Z" },
    [[5, 1], [2, 2], [1, 3]]),
  g({ id: 6, group_name: "Exit Visa Requests", group_code: "EXV-GCC", module_key: "EXIT_VISA", created_at: "2026-07-21T09:00:00Z" },
    [[4, 1], [2, 2]]),
  g({ id: 7, group_name: "Staff Loan Committee", group_code: "LOAN-CMT", module_key: "LOAN", description: "Retired — loans now go through payroll sign-off.", is_active: false, created_at: "2025-11-10T09:00:00Z" },
    [[5, 1], [1, 2]]),
];

export const APPR_findGroup = (id) =>
  APPR_GROUPS.find((x) => String(x.id) === String(id)) || null;

// Create / update / remove keep APPR_GROUPS in sync so other screens see it.
export const APPR_addGroup = (payload) => {
  const { members = [], ...rest } = payload;
  const group = APPR_buildGroup(
    {
      id: nextId(APPR_GROUPS),
      scope: "GLOBAL",
      project_id: null,
      description: null,
      is_active: true,
      created_at: new Date().toISOString(),
      ...rest,
    },
    members,
  );
  APPR_GROUPS.unshift(group);
  return group;
};

export const APPR_updateGroup = (id, data) => {
  const idx = APPR_GROUPS.findIndex((x) => String(x.id) === String(id));
  if (idx === -1) return null;
  const cur = APPR_GROUPS[idx];
  const { members, ...rest } = data;
  let next = { ...cur, ...rest };
  if (members) {
    const base = { ...next };
    delete base.levels;
    delete base.total_levels;
    next = APPR_buildGroup(base, members);
  }
  APPR_GROUPS[idx] = next;
  return next;
};

export const APPR_removeGroup = (id) => {
  const idx = APPR_GROUPS.findIndex((x) => String(x.id) === String(id));
  if (idx !== -1) APPR_GROUPS.splice(idx, 1);
};

const ref = (id) => {
  const grp = APPR_GROUPS.find((x) => x.id === id);
  return grp
    ? { id: grp.id, group_name: grp.group_name, group_code: grp.group_code, is_active: grp.is_active }
    : null;
};

const binding = (projectId, groupId) => ({
  project_id: projectId,
  project_name: APPR_PROJECTS.find((p) => p.id === projectId)?.project_name || null,
  group: ref(groupId),
});

// GET /approval-assignments — one row per supported purpose.
export const APPR_ASSIGNMENTS = [
  {
    module_key: "LEAVE",
    label: "Leave",
    default_group: ref(1),
    bindings: [binding(3, 4), binding(1, 1)],
  },
  {
    module_key: "PAYROLL",
    label: "Salary",
    default_group: null,
    bindings: [],
  },
];

export const APPR_bindingFor = binding;
export const APPR_groupRef = ref;
