// Static data for group D — attendance tracker, attendance reports and
// attendance-correction requests. Everything is generated deterministically
// from the shared EMPLOYEES / PROJECTS so every month of FY 2026 looks filled.
import { EMPLOYEES, PROJECTS, paginate, matches } from "../common.js";

// "Today" for the static build — days after it render as FUTURE.
export const ATT_TODAY = "2026-10-17";

const pad = (n) => String(n).padStart(2, "0");
const OFFSET = "+04:00"; // Asia/Dubai

// Weekly off = Friday (6-day GCC site week).
const WEEKLY_OFF_DAY = 5;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// UAE public holidays 2026 (approximate Hijri dates).
export const ATT_HOLIDAYS = [
  "2026-01-01",
  "2026-03-19",
  "2026-03-20",
  "2026-03-21",
  "2026-05-26",
  "2026-05-27",
  "2026-05-28",
  "2026-06-16",
  "2026-08-25",
  "2026-12-01",
  "2026-12-02",
  "2026-12-03",
];

const SHIFTS = {
  GENERAL: { name: "General Shift", start_time: "08:00:00", end_time: "17:00:00" },
  SITE: { name: "Site Shift", start_time: "07:00:00", end_time: "16:00:00" },
};

const SUPPLIER = "Gulf Manpower Services";

// Project rows as the project list returns them (project_name, not name).
export const ATT_PROJECTS = PROJECTS.map((p) => ({ ...p, project_name: p.name }));

// Active employees with the fields the attendance screens read.
export const ATT_EMPLOYEES = EMPLOYEES.filter((e) => e.status === "ACTIVE").map((e) => {
  const site = e.department_id === 4;
  const primary = ATT_PROJECTS[(e.id - 1) % ATT_PROJECTS.length];
  const secondary = ATT_PROJECTS[e.id % ATT_PROJECTS.length];
  return {
    ...e,
    country_emp_id: e.employee_code,
    profile_url: null,
    shift: site ? SHIFTS.SITE : SHIFTS.GENERAL,
    designation_label: e.designation?.name || null,
    supplier: e.employment_type === "CONTRACT" ? SUPPLIER : null,
    primary_project: primary,
    secondary_project: secondary,
  };
});

const attEmployee = (id) => ATT_EMPLOYEES.find((e) => e.id === Number(id)) || ATT_EMPLOYEES[0];

// Deterministic 0..99 for (employee, date, salt).
const hash = (empId, dateStr, salt = 0) => {
  let h = 2166136261 ^ (empId * 7919 + salt * 104729);
  for (let i = 0; i < dateStr.length; i += 1) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % 100;
};

const weekdayOf = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const daysInMonthOf = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

const iso = (dateStr, mins) => `${dateStr}T${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00${OFFSET}`;
const hm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

// One employee-day: status + sessions, mirroring the backend deriveDay().
// Statuses: PRESENT | INCOMPLETE | ABSENT | LEAVE | WEEKLY_OFF | HOLIDAY | FUTURE
// reports=true keeps the whole month filled (sample report data for any 2026 month).
const deriveDay = (emp, dateStr, { reports = false } = {}) => {
  const empty = (status) => ({
    status,
    check_in_time: null,
    check_out_time: null,
    total_minutes: 0,
    total_hours: 0,
    is_late: false,
    missing_checkout: false,
    project_name: null,
    project_id: null,
    sessions: [],
  });
  if (!reports && dateStr > ATT_TODAY) return empty("FUTURE");
  if (weekdayOf(dateStr) === WEEKLY_OFF_DAY) return empty("WEEKLY_OFF");
  if (ATT_HOLIDAYS.includes(dateStr)) return empty("HOLIDAY");

  const r = hash(emp.id, dateStr);
  if (r < 6) return empty("ABSENT");
  if (r < 10) return empty("LEAVE");

  const project = hash(emp.id, dateStr, 3) < 15 ? emp.secondary_project : emp.primary_project;
  const shiftStart = emp.shift === SHIFTS.SITE ? 7 * 60 : 8 * 60;
  const inMin = shiftStart - 15 + (hash(emp.id, dateStr, 1) % 28); // up to ~12 min late
  const outMin = shiftStart + 9 * 60 + (hash(emp.id, dateStr, 2) % 40);
  const incomplete = r < 14 || (dateStr === ATT_TODAY && r < 30);
  const split = r % 3 === 0;

  let sessions;
  if (split) {
    const lunchOut = shiftStart + 5 * 60;
    const lunchIn = lunchOut + 45;
    sessions = [
      { check_in_time: iso(dateStr, inMin), check_out_time: iso(dateStr, lunchOut), project_name: project.project_name },
      { check_in_time: iso(dateStr, lunchIn), check_out_time: incomplete ? null : iso(dateStr, outMin), project_name: project.project_name },
    ];
  } else {
    sessions = [
      { check_in_time: iso(dateStr, inMin), check_out_time: incomplete ? null : iso(dateStr, outMin), project_name: project.project_name },
    ];
  }

  let total = 0;
  if (split) total += shiftStart + 5 * 60 - inMin;
  if (!incomplete) total += split ? outMin - (shiftStart + 5 * 60 + 45) : outMin - inMin;

  return {
    status: incomplete ? "INCOMPLETE" : "PRESENT",
    check_in_time: sessions[0].check_in_time,
    check_out_time: sessions[sessions.length - 1].check_out_time,
    total_minutes: total,
    total_hours: Number((total / 60).toFixed(2)),
    is_late: inMin > shiftStart + 5,
    missing_checkout: incomplete,
    project_name: project.project_name,
    project_id: project.id,
    sessions,
    _inMin: inMin,
    _outMin: incomplete ? null : outMin,
    _split: split,
  };
};

// Employees visible under an optional project filter + search.
const filterEmployees = ({ projectId, search } = {}) =>
  ATT_EMPLOYEES.filter(
    (e) =>
      (!projectId ||
        e.primary_project.id === Number(projectId) ||
        e.secondary_project.id === Number(projectId)) &&
      matches(e, search, ["full_name", "country_emp_id", "email"]),
  );

// ── Tracker: summary cards for a day ──
export const ATT_getSummary = (date) => {
  const out = { date, total_employees: ATT_EMPLOYEES.length, present: 0, absent: 0, leave: 0, weekly_off: 0, holiday: 0, missing_check_ins: 0 };
  ATT_EMPLOYEES.forEach((e) => {
    const d = deriveDay(e, date);
    if (d.status === "PRESENT" || d.status === "INCOMPLETE") out.present += 1;
    if (d.status === "INCOMPLETE") out.missing_check_ins += 1;
    if (d.status === "ABSENT" || d.status === "LEAVE") out.absent += 1;
    if (d.status === "LEAVE") out.leave += 1;
    if (d.status === "WEEKLY_OFF") out.weekly_off += 1;
    if (d.status === "HOLIDAY") out.holiday += 1;
  });
  return out;
};

// ── Tracker: daily list ──
export const ATT_getDaily = ({ date, projectId, status, search, page = 1, limit = 10 }) => {
  const rows = filterEmployees({ projectId, search })
    .map((e) => {
      const d = deriveDay(e, date);
      return {
        employee_id: e.id,
        full_name: e.full_name,
        country_emp_id: e.country_emp_id,
        profile_url: e.profile_url,
        designation: e.designation_label,
        shift: e.shift,
        work_date: date,
        project_name: d.project_name,
        check_in_time: d.check_in_time,
        check_out_time: d.check_out_time,
        total_hours: d.total_hours,
        status: d.status,
        is_late: d.is_late,
        missing_checkout: d.missing_checkout,
      };
    })
    .filter((r) => !status || r.status === status);
  const p = paginate(rows, page, limit);
  return { data: p.rows, total: p.total, total_pages: p.totalPages, date };
};

// ── Tracker: monthly matrix ──
export const ATT_getMonthly = ({ month, projectId, search, page = 1, limit = 10 }) => {
  const dim = daysInMonthOf(month);
  const rows = filterEmployees({ projectId, search }).map((e) => {
    const days = {};
    let present = 0, absent = 0, leave = 0, weekly_off = 0, holiday = 0, incomplete = 0, workingDays = 0, minutes = 0;
    for (let day = 1; day <= dim; day += 1) {
      const ds = `${month}-${pad(day)}`;
      const d = deriveDay(e, ds);
      let st = d.status;
      if (projectId && d.project_id && d.project_id !== Number(projectId)) st = "OP";
      days[day] = st;
      if (d.status === "PRESENT" || d.status === "INCOMPLETE") { present += 1; workingDays += 1; minutes += d.total_minutes; }
      if (d.status === "INCOMPLETE") incomplete += 1;
      if (d.status === "ABSENT") { absent += 1; workingDays += 1; }
      if (d.status === "LEAVE") { leave += 1; workingDays += 1; }
      if (d.status === "WEEKLY_OFF") weekly_off += 1;
      if (d.status === "HOLIDAY") holiday += 1;
    }
    return {
      employee_id: e.id,
      full_name: e.full_name,
      country_emp_id: e.country_emp_id,
      profile_url: e.profile_url,
      designation: e.designation_label,
      shift: e.shift,
      days,
      summary: {
        present,
        absent,
        leave,
        weekly_off,
        holiday,
        incomplete,
        attendance_pct: workingDays ? Math.round((present / workingDays) * 100) : 0,
        total_hours: Number((minutes / 60).toFixed(2)),
      },
    };
  });
  const p = paginate(rows, page, limit);
  return { month, days_in_month: dim, data: p.rows, total: p.total, total_pages: p.totalPages };
};

// ── Tracker: one employee's day (timeline modal) ──
export const ATT_getEmployeeDay = (employeeId, date) => {
  const e = attEmployee(employeeId);
  const d = deriveDay(e, date);
  return {
    employee: { id: e.id, full_name: e.full_name, country_emp_id: e.country_emp_id, shift: e.shift },
    date,
    status: d.status,
    total_hours: d.total_hours,
    sessions: d.sessions.map((s) => ({ ...s })),
  };
};

// ── Reports: employee picker ──
export const ATT_REPORT_EMPLOYEES = ATT_EMPLOYEES.map((e) => ({
  id: e.id,
  full_name: e.full_name,
  country_emp_id: e.country_emp_id,
  email: e.email,
}));

const otFor = (emp, dateStr, d) => {
  if (d.status !== "PRESENT" || hash(emp.id, dateStr, 5) >= 12) return null;
  const start = (d._outMin || 17 * 60) + 30;
  const hours = 1 + (hash(emp.id, dateStr, 6) % 3);
  return {
    start_time: iso(dateStr, start),
    end_time: iso(dateStr, start + hours * 60),
    hours,
    approved_by: "Omar Haddad",
  };
};

const hoursPerDay = () => 9; // both shifts are 9 hours

// ── Report 1: one employee × one month ──
export const ATT_getEmployeeMonthlyReport = (employeeId, month) => {
  const e = attEmployee(employeeId);
  const [Y, M] = month.split("-").map(Number);
  const dim = daysInMonthOf(month);
  const days = [];
  let workedMin = 0, otTotal = 0;
  let present = 0, absent = 0, weeklyOff = 0, holiday = 0, leaveCount = 0, workingDays = 0;
  for (let day = 1; day <= dim; day += 1) {
    const ds = `${month}-${pad(day)}`;
    const d = deriveDay(e, ds, { reports: true });
    const st = d.status;
    if (st === "PRESENT" || st === "INCOMPLETE") { present += 1; workingDays += 1; }
    else if (st === "ABSENT") { absent += 1; workingDays += 1; }
    else if (st === "LEAVE") { leaveCount += 1; workingDays += 1; }
    else if (st === "WEEKLY_OFF") weeklyOff += 1;
    else if (st === "HOLIDAY") holiday += 1;
    workedMin += d.total_minutes;
    const ot = otFor(e, ds, d);
    if (ot) otTotal += ot.hours;
    const shiftStart = e.shift === SHIFTS.SITE ? 7 * 60 : 8 * 60;
    days.push({
      date: ds,
      day,
      weekday: WEEKDAYS[new Date(Y, M - 1, day).getDay()],
      status: st,
      morning_in: d.sessions.length ? hm(d._inMin) : null,
      morning_out: d.sessions.length ? (d._split ? hm(shiftStart + 5 * 60) : d._outMin != null ? hm(d._outMin) : null) : null,
      afternoon_in: d._split ? hm(shiftStart + 5 * 60 + 45) : null,
      afternoon_out: d._split && d._outMin != null ? hm(d._outMin) : null,
      ot_in: ot ? ot.start_time : null,
      ot_out: ot ? ot.end_time : null,
      ot_hours: ot ? ot.hours : 0,
      day_hours: d.total_hours,
      approved_by: ot ? ot.approved_by : null,
      remark: st === "FUTURE" || st === "PRESENT" || st === "INCOMPLETE" ? "" : st.replace("_", " "),
    });
  }
  return {
    employee: {
      id: e.id,
      full_name: e.full_name,
      country_emp_id: e.country_emp_id,
      employment_type: e.employment_type,
      designation: e.designation_label,
      supplier: e.supplier,
      shift: e.shift,
    },
    month,
    days_in_month: dim,
    days,
    totals: {
      worked_hours: Number((workedMin / 60).toFixed(2)),
      overtime_hours: otTotal,
      present_days: present,
      absent_days: absent,
      weekly_off: weeklyOff,
      holiday,
      leave_days: leaveCount,
      working_days: workingDays,
      allotted_hours: workingDays * hoursPerDay(e),
    },
  };
};

// ── Report 2: all employees × days grid (OWN | STAFFING | ALL) ──
export const ATT_getMonthlyGrid = ({ month, type = "ALL", page = 1, limit = 25 }) => {
  const dim = daysInMonthOf(month);
  const list = ATT_EMPLOYEES.filter((e) =>
    type === "OWN" ? !e.supplier : type === "STAFFING" ? !!e.supplier : true,
  );
  const rows = list.map((e) => {
    const days = {};
    let workedMin = 0, workingDays = 0, ot = 0;
    for (let day = 1; day <= dim; day += 1) {
      const ds = `${month}-${pad(day)}`;
      const d = deriveDay(e, ds, { reports: true });
      if (d.status === "PRESENT" || d.status === "INCOMPLETE") {
        days[day] = d.total_hours;
        workedMin += d.total_minutes;
        workingDays += 1;
      } else if (d.status === "ABSENT") { days[day] = "A"; workingDays += 1; }
      else if (d.status === "LEAVE") { days[day] = "L"; workingDays += 1; }
      else if (d.status === "WEEKLY_OFF") days[day] = "W";
      else if (d.status === "HOLIDAY") days[day] = "H";
      else days[day] = "";
      const o = otFor(e, ds, d);
      if (o) ot += o.hours;
    }
    return {
      employee_id: e.id,
      name: e.full_name,
      code: e.country_emp_id,
      designation: e.designation_label,
      supplier: e.supplier,
      employment_type: e.employment_type,
      days,
      total_worked_hours: Number((workedMin / 60).toFixed(2)),
      total_allotted_hours: workingDays * hoursPerDay(e),
      approved_overtime_hours: ot,
      status: "Active",
    };
  });
  const p = paginate(rows, page, limit);
  return { month, days_in_month: dim, type, page, limit, data: p.rows, total: p.total, total_pages: p.totalPages };
};

// ── Correction requests ──
// Two-level approval chain; levels_summary mirrors the backend shape.
const levels = (l1, l2) => [
  { level_no: 1, total: 1, approved: l1 === "APPROVED" ? 1 : 0, pending: l1 === "PENDING" ? 1 : 0 },
  { level_no: 2, total: 1, approved: l2 === "APPROVED" ? 1 : 0, pending: l2 === "PENDING" ? 1 : 0 },
];

// requested_check_in/out are wall-clock times stored as UTC datetimes.
const corr = (id, work_date, inT, outT, reason, status, l1, l2, extra = {}) => ({
  id,
  employee_id: 4,
  work_date,
  requested_check_in: `${work_date}T${inT}:00.000Z`,
  requested_check_out: `${work_date}T${outT}:00.000Z`,
  reason,
  status,
  attachment_url: null,
  levels_summary: levels(l1, l2),
  current_level: l1 === "APPROVED" ? 2 : 1,
  created_at: `${work_date}T14:00:00.000Z`,
  ...extra,
});

// The logged-in employee's own correction requests ("mine").
export const ATT_CORRECTIONS = [
  corr(1, "2026-10-14", "08:05", "17:10", "Forgot to check out after the client meeting", "PENDING", "PENDING", "PENDING"),
  corr(2, "2026-10-08", "07:55", "17:00", "Biometric device at Marina site was offline", "PENDING", "APPROVED", "PENDING", { attachment_url: "uploads/corrections/site-device-log.pdf" }),
  corr(3, "2026-09-29", "08:00", "18:30", "Worked late on payroll closing, app did not sync", "APPROVED", "APPROVED", "APPROVED"),
  corr(4, "2026-09-17", "09:00", "17:00", "Mobile check in failed due to GPS issue", "REJECTED", "REJECTED", "PENDING"),
  corr(5, "2026-09-03", "08:10", "17:05", "Attended training at Abu Dhabi branch", "APPROVED", "APPROVED", "APPROVED"),
  corr(6, "2026-08-20", "22:00", "06:00", "Night shift support for system migration", "APPROVED", "APPROVED", "APPROVED"),
  corr(7, "2026-08-11", "08:00", "16:45", "Check out missed, left early with manager approval", "REJECTED", "APPROVED", "REJECTED"),
  corr(8, "2026-07-22", "07:50", "17:00", "Phone battery died before check in", "APPROVED", "APPROVED", "APPROVED"),
];

// Approver inbox items (pending + recently acted), as the approval list returns them.
const inbox = (n, entity_id, emp, work_date, detail, state) => {
  const base = {
    approval_request_id: 100 + n,
    entity_id,
    employee_id: emp.id,
    employee_name: emp.full_name,
    work_date,
    ...detail,
  };
  switch (state) {
    case "ACT_L1":
      return { ...base, current_level: 1, levels_summary: levels("PENDING", "PENDING"), can_act: true, can_reject: true, my_action_status: "PENDING", final_status: "PENDING" };
    case "ACT_L2":
      return { ...base, current_level: 2, levels_summary: levels("APPROVED", "PENDING"), can_act: true, can_reject: true, my_action_status: "PENDING", final_status: "PENDING" };
    case "WAIT":
      return { ...base, current_level: 1, levels_summary: levels("PENDING", "PENDING"), can_act: false, can_reject: false, my_action_status: "PENDING", final_status: "PENDING" };
    case "MINE_APPROVED":
      return { ...base, current_level: 2, levels_summary: levels("APPROVED", "PENDING"), can_act: false, can_reject: false, my_action_status: "APPROVED", final_status: "PENDING" };
    case "MINE_REJECTED":
      return { ...base, current_level: 1, levels_summary: levels("REJECTED", "PENDING"), can_act: false, can_reject: false, my_action_status: "REJECTED", final_status: "REJECTED" };
    case "FINAL_APPROVED":
    default:
      return { ...base, current_level: 2, levels_summary: levels("APPROVED", "APPROVED"), can_act: false, can_reject: false, my_action_status: null, final_status: "APPROVED" };
  }
};

const E = (id) => attEmployee(id);

export const ATT_CORRECTION_INBOX = [
  inbox(1, 21, E(3), "2026-10-15", { reason: "Forgot to check out after the sprint demo" }, "ACT_L1"),
  inbox(2, 22, E(9), "2026-10-13", { reason: "Biometric reader at Yas Mall site was down" }, "ACT_L2"),
  inbox(3, 23, E(6), "2026-10-12", { reason: "Worked from Abu Dhabi branch, check in not recorded" }, "ACT_L1"),
  inbox(4, 24, E(12), "2026-10-10", { reason: "GPS failed during site check in" }, "WAIT"),
  inbox(5, 25, E(7), "2026-10-06", { reason: "Night shift at Riyadh Metro, checkout missed" }, "MINE_APPROVED"),
  inbox(6, 26, E(10), "2026-09-30", { reason: "Late entry, no supporting reason" }, "MINE_REJECTED"),
  inbox(7, 27, E(8), "2026-09-24", { reason: "Client visit in Sharjah all day" }, "FINAL_APPROVED"),
  inbox(8, 28, E(5), "2026-09-18", { reason: "Phone switched off, attended audit meeting" }, "ACT_L1"),
];

export const ATT_OVERTIME_INBOX = [
  inbox(11, 41, E(9), "2026-10-14", { overtime_hours: 3, reason: "Concrete pour at Yas Mall" }, "ACT_L1"),
  inbox(12, 42, E(10), "2026-10-11", { overtime_hours: 2, reason: "Fit-out snag list" }, "ACT_L2"),
  inbox(13, 43, E(7), "2026-10-07", { overtime_hours: 4, reason: "Metro night maintenance" }, "WAIT"),
  inbox(14, 44, E(12), "2026-09-28", { overtime_hours: 2.5, reason: "Material delivery" }, "MINE_APPROVED"),
  inbox(15, 45, E(3), "2026-09-20", { overtime_hours: 1.5, reason: "Release support" }, "FINAL_APPROVED"),
];
