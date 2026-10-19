// Static data for group B: employees (list, detail tabs, add/edit wizards),
// documents, and the multi-company invitation / collaboration screens.
// Built on the shared entities in common.js so the same people and projects
// appear everywhere. A few small mutable stores let actions (approve, upload,
// edit, invite…) show up across screens for the rest of the session.

import {
  EMPLOYEES,
  PROJECTS,
  DEPARTMENTS,
  DESIGNATIONS,
  nextId,
} from "./common";
import { getStaticUser } from "./session";

// ─────────────────────────────────────────────────────────────────────────────
// Lookups used by the Add / Edit employee forms
// ─────────────────────────────────────────────────────────────────────────────

export const B_ROLES = [
  ...DESIGNATIONS.map((d) => ({ id: d.id, name: d.name })),
  { id: 9, name: "Company Admin" },
];

export const B_COUNTRIES = [
  { id: 1, name: "United Arab Emirates", iso2: "AE", calling_code: "+971" },
  { id: 2, name: "Saudi Arabia", iso2: "SA", calling_code: "+966" },
  { id: 3, name: "Qatar", iso2: "QA", calling_code: "+974" },
  { id: 4, name: "Kuwait", iso2: "KW", calling_code: "+965" },
  { id: 5, name: "Oman", iso2: "OM", calling_code: "+968" },
  { id: 6, name: "Bahrain", iso2: "BH", calling_code: "+973" },
  { id: 7, name: "India", iso2: "IN", calling_code: "+91" },
  { id: 8, name: "Pakistan", iso2: "PK", calling_code: "+92" },
  { id: 9, name: "Philippines", iso2: "PH", calling_code: "+63" },
  { id: 10, name: "Egypt", iso2: "EG", calling_code: "+20" },
  { id: 11, name: "Jordan", iso2: "JO", calling_code: "+962" },
  { id: 12, name: "Lebanon", iso2: "LB", calling_code: "+961" },
  { id: 13, name: "Bangladesh", iso2: "BD", calling_code: "+880" },
  { id: 14, name: "Nepal", iso2: "NP", calling_code: "+977" },
  { id: 15, name: "Sri Lanka", iso2: "LK", calling_code: "+94" },
  { id: 16, name: "United Kingdom", iso2: "GB", calling_code: "+44" },
  { id: 17, name: "United States", iso2: "US", calling_code: "+1" },
];

// Client-side stand-in for the country search endpoint.
export const searchCountries = (search = "", limit = 100) => {
  const q = String(search || "").trim().toLowerCase();
  return B_COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, limit);
};

export const STAFFING_COMPANIES = [
  { id: 1, name: "Gulf Manpower Services", code: "GMS", status: "ACTIVE" },
  { id: 2, name: "Al Tamimi Staffing", code: "ATS", status: "ACTIVE" },
  { id: 3, name: "Emirates Workforce Solutions", code: "EWS", status: "ACTIVE" },
];

export const LEAVE_POLICIES = [
  { id: 1, policy_name: "Annual Leave (UAE)", leave_type: { leave_name: "Annual Leave" }, is_active: true },
  { id: 2, policy_name: "Sick Leave (UAE)", leave_type: { leave_name: "Sick Leave" }, is_active: true },
  { id: 3, policy_name: "Annual Leave (KSA)", leave_type: { leave_name: "Annual Leave" }, is_active: true },
  { id: 4, policy_name: "Hajj Leave", leave_type: { leave_name: "Hajj Leave" }, is_active: true },
  { id: 5, policy_name: "Maternity Leave", leave_type: { leave_name: "Maternity Leave" }, is_active: true },
];

export const SHIFTS = [
  { id: 1, name: "General Shift", start_time: "09:00:00", end_time: "18:00:00" },
  { id: 2, name: "Site Morning", start_time: "06:00:00", end_time: "15:00:00" },
  { id: 3, name: "Site Night", start_time: "20:00:00", end_time: "05:00:00" },
  { id: 4, name: "Ramadan Hours", start_time: "09:00:00", end_time: "15:00:00" },
];

export const SALARY_CATALOG = [
  { id: 1, name: "Basic", code: "BASIC", type: "EARNING", is_system: true, is_active: true },
  { id: 2, name: "Hourly", code: "HOURLY", type: "EARNING", is_system: true, is_active: true },
  { id: 3, name: "Housing Allowance", code: "HOUSING", type: "EARNING", is_system: false, is_active: true },
  { id: 4, name: "Transport Allowance", code: "TRANSPORT", type: "EARNING", is_system: false, is_active: true },
  { id: 5, name: "Food Allowance", code: "FOOD", type: "EARNING", is_system: false, is_active: true },
  { id: 6, name: "GOSI Contribution", code: "GOSI", type: "DEDUCTION", is_system: false, is_active: true },
  { id: 7, name: "Loan Repayment", code: "LOAN", type: "DEDUCTION", is_system: false, is_active: true },
  { id: 8, name: "Absence Deduction", code: "ABSENCE", type: "DEDUCTION", is_system: false, is_active: true },
];

// Grouped shape of GET /salary-components?grouped=true
export const SALARY_CATALOG_GROUPED = {
  earnings: SALARY_CATALOG.filter((c) => c.type === "EARNING"),
  deductions: SALARY_CATALOG.filter((c) => c.type === "DEDUCTION"),
};

export const designationsForDepartment = (departmentId) =>
  DESIGNATIONS.filter((d) => String(d.department_id) === String(departmentId));

export { DEPARTMENTS };

// Project shape the employee screens read ({ id, project_name, project_code }).
export const apiProject = (p) => ({
  id: p.id,
  project_name: p.name,
  project_code: p.code,
  project_location: p.location,
  client_name: p.client_name,
  status: p.status,
});
export const B_PROJECTS = PROJECTS.map(apiProject);

// ─────────────────────────────────────────────────────────────────────────────
// Employees (API shape of GET /employee and GET /employee/:id)
// ─────────────────────────────────────────────────────────────────────────────

const PROJECTS_BY_EMPLOYEE = {
  1: [4], 2: [], 3: [1, 4], 4: [], 5: [2], 6: [1], 7: [3], 8: [2], 9: [2], 10: [1], 11: [], 12: [3],
};
const STAFFING_BY_EMPLOYEE = { 9: 1, 10: 2 };
const EMPLOYMENT_STATUS = { 10: "IN_NOTICE", 11: "EXITED" };
const ACCOMMODATION = {
  7: "Al Malaz Staff Housing, Riyadh",
  9: "Mussafah Labour Camp, Abu Dhabi",
  10: "Al Quoz Staff Village, Dubai",
  12: "Al Quoz Staff Village, Dubai",
};
const ADDRESSES = {
  1: "Apt 1204, Marina Gate 2, Dubai Marina, Dubai",
  2: "Villa 18, Al Barsha 2, Dubai",
  3: "Flat 506, Silicon Oasis Tower, Dubai",
  4: "Apt 301, Al Nahda 1, Dubai",
  5: "Flat 902, Al Reem Island, Abu Dhabi",
  6: "Apt 1101, JLT Cluster D, Dubai",
  7: "Al Olaya District, Riyadh",
  8: "Apt 707, Business Bay, Dubai",
  9: "Mussafah Industrial Area, Abu Dhabi",
  10: "Al Quoz 4, Dubai",
  11: "Apt 410, Discovery Gardens, Dubai",
  12: "Al Quoz 4, Dubai",
};

const toRecord = (e) => {
  const projects = (PROJECTS_BY_EMPLOYEE[e.id] || [])
    .map((pid) => PROJECTS.find((p) => p.id === pid))
    .filter(Boolean)
    .map(apiProject);
  const staffingId = STAFFING_BY_EMPLOYEE[e.id];
  const staffingCompany = staffingId ? STAFFING_COMPANIES.find((s) => s.id === staffingId) : null;
  const role = B_ROLES.find((r) => r.id === e.designation_id) || B_ROLES[0];
  const shift = e.office_id === 1 ? SHIFTS[0] : SHIFTS[1];
  return {
    ...e,
    // Plain strings here: some modals render employee.designation directly.
    designation: e.designation_name,
    department: e.department_name,
    country_emp_id: e.employee_code,
    iqama_number: String(2400000000 + e.id * 13791173).slice(0, 10),
    full_name: e.full_name,
    email: e.email,
    phone_number: e.phone.replace(/\s+/g, ""),
    profile_url: null,
    roles: [{ id: role.id, name: role.name }],
    role_id: role.id,
    projects,
    main_project_id: projects[0]?.id || null,
    staffingCompany,
    staffing_company_id: staffingCompany?.id || null,
    user_status: e.status,
    employment_status: EMPLOYMENT_STATUS[e.id] || "ACTIVE",
    accommodation: ACCOMMODATION[e.id] || null,
    address: ADDRESSES[e.id] || "",
    shift,
    shift_id: shift.id,
    overtime_rate: e.employment_type === "CONTRACT" ? 1.25 : 1.5,
    access_level: e.access_level === "ADMIN" ? "ADMIN" : "EMPLOYEE",
    leave_policy_ids: e.office_id === 3 ? [3, 2] : [1, 2],
  };
};

// Mutable for the session: edits / new hires show up on the list and detail.
export const EMPLOYEE_RECORDS = EMPLOYEES.map(toRecord);

export const getEmployeeRecord = (id) =>
  EMPLOYEE_RECORDS.find((e) => String(e.id) === String(id)) || null;

export const updateEmployeeRecord = (id, patch) => {
  const idx = EMPLOYEE_RECORDS.findIndex((e) => String(e.id) === String(id));
  if (idx === -1) return null;
  EMPLOYEE_RECORDS[idx] = { ...EMPLOYEE_RECORDS[idx], ...patch };
  return EMPLOYEE_RECORDS[idx];
};

export const addEmployeeRecord = (fields) => {
  const id = nextId(EMPLOYEE_RECORDS);
  const rec = {
    id,
    employee_code: fields.country_emp_id || `EMP-${String(id).padStart(4, "0")}`,
    country_emp_id: fields.country_emp_id || `EMP-${String(id).padStart(4, "0")}`,
    iqama_number: fields.iqama_number || null,
    status: "ACTIVE",
    user_status: "ACTIVE",
    employment_status: "ACTIVE",
    profile_url: fields.profile_url || null,
    projects: [],
    roles: [],
    staffingCompany: null,
    ...fields,
  };
  EMPLOYEE_RECORDS.unshift(rec);
  return rec;
};

// Which record is "me" for the employee-panel screens (matched by email).
export const currentEmployeeRecord = () => {
  const user = getStaticUser();
  return (
    EMPLOYEE_RECORDS.find((e) => e.email === user?.email) ||
    getEmployeeRecord(user?.employee_id) ||
    null
  );
};

// Open exits shown on the employee detail banner.
export const EMPLOYEE_EXITS = [
  {
    id: 3,
    employee_id: 10,
    exit_type: "RESIGNATION",
    status: "IN_NOTICE",
    notice: { last_working_day: "2026-11-15", days_left: 29 },
    checklist_progress: { closed: 3, total: 7 },
  },
  {
    id: 2,
    employee_id: 11,
    exit_type: "TERMINATION",
    status: "EXITED",
    notice: { last_working_day: "2026-09-30", days_left: 0 },
    checklist_progress: { closed: 6, total: 6 },
  },
];

export const openExitFor = (employeeId) =>
  EMPLOYEE_EXITS.find(
    (x) => String(x.employee_id) === String(employeeId) && ["IN_NOTICE", "EXITED"].includes(x.status),
  ) || null;

// ─────────────────────────────────────────────────────────────────────────────
// Employee drafts (saved Add Employee wizards)
// ─────────────────────────────────────────────────────────────────────────────

export const EMPLOYEE_DRAFTS = [
  {
    id: 1,
    full_name: "Hamza Qureshi",
    email: "hamza.qureshi@fyinder.com",
    current_step: 3,
    updated_at: "2026-10-15T11:42:00+04:00",
    updated_by: { name: "Fatima Al Zahra", email: "fatima.alzahra@fyinder.com" },
    data: {
      values: {
        fullName: "Hamza Qureshi",
        nationality: "Pakistan",
        countryCode: "+971",
        phone: "502846193",
        email: "hamza.qureshi@fyinder.com",
        countryEmpId: "EMP-0013",
        address: "Al Nahda 2, Dubai",
        employmentType: "Full-time",
        dateOfJoining: "2026-11-02",
        designatedRole: "6",
        projectIds: [1],
        mainProjectId: 1,
        accessLevel: "EMPLOYEE",
        leavePolicyIds: [1, 2],
        shiftId: "2",
        departmentId: "4",
        designationId: "6",
        salaryCurrency: "AED",
      },
      docs: [],
      approvalRouting: [],
      profileUrl: null,
    },
  },
  {
    id: 2,
    full_name: "Grace Fernandes",
    email: "grace.fernandes@fyinder.com",
    current_step: 5,
    updated_at: "2026-10-12T16:05:00+04:00",
    updated_by: { name: "Sara Khan", email: "sara.khan@fyinder.com" },
    data: {
      values: {
        fullName: "Grace Fernandes",
        nationality: "India",
        countryCode: "+971",
        phone: "554471280",
        email: "grace.fernandes@fyinder.com",
        countryEmpId: "EMP-0014",
        address: "Karama, Dubai",
        employmentType: "Full-time",
        dateOfJoining: "2026-10-26",
        designatedRole: "5",
        projectIds: [2],
        mainProjectId: 2,
        accessLevel: "EMPLOYEE",
        leavePolicyIds: [1, 2],
        shiftId: "1",
        departmentId: "3",
        designationId: "5",
        salaryCurrency: "AED",
        salaryCalcMode: "MONTHLY_FIXED",
        salaryComponents: [
          { salary_component_id: 1, calculation_type: "FIXED", amount: "9500" },
          { salary_component_id: 3, calculation_type: "PERCENTAGE", amount: "25" },
        ],
      },
      docs: [],
      approvalRouting: [],
      profileUrl: null,
    },
  },
  {
    id: 3,
    full_name: "",
    email: "",
    current_step: 1,
    updated_at: "2026-10-08T09:18:00+04:00",
    created_by: { name: "Ahmed Al Mansoori", email: "ahmed@fyinder.com" },
    data: { values: {}, docs: [], approvalRouting: [], profileUrl: null },
  },
];

export const getDraft = (id) =>
  EMPLOYEE_DRAFTS.find((d) => String(d.id) === String(id)) || null;

export const saveDraft = (id, payload) => {
  const now = new Date().toISOString();
  const values = payload?.data?.values || {};
  const user = getStaticUser();
  const existing = id ? getDraft(id) : null;
  if (existing) {
    Object.assign(existing, {
      current_step: payload.current_step,
      data: payload.data,
      full_name: values.fullName || "",
      email: values.email || "",
      updated_at: now,
      updated_by: { name: user.name, email: user.email },
    });
    return existing;
  }
  const draft = {
    id: nextId(EMPLOYEE_DRAFTS),
    current_step: payload.current_step,
    data: payload.data,
    full_name: values.fullName || "",
    email: values.email || "",
    updated_at: now,
    updated_by: { name: user.name, email: user.email },
  };
  EMPLOYEE_DRAFTS.unshift(draft);
  return draft;
};

export const deleteDraft = (id) => {
  const idx = EMPLOYEE_DRAFTS.findIndex((d) => String(d.id) === String(id));
  if (idx !== -1) EMPLOYEE_DRAFTS.splice(idx, 1);
};

// ─────────────────────────────────────────────────────────────────────────────
// Salary + payslips (Overview / Payroll tabs)
// ─────────────────────────────────────────────────────────────────────────────

const comp = (id) => SALARY_CATALOG.find((c) => c.id === id);
const line = (id, amount, calculation_type = "FIXED", resolved = amount) => ({
  component_id: id,
  name: comp(id).name,
  code: comp(id).code,
  calculation_type,
  amount,
  resolved_amount: resolved,
});

export const employeeSalary = (employeeId) => {
  const e = getEmployeeRecord(employeeId);
  if (!e || e.id === 11) return { current: null };
  const currency = e.office_id === 3 ? "SAR" : "AED";

  if (e.id === 9) {
    const rate = 25;
    const earnings = [line(2, rate, "FIXED", rate * 208)];
    const deductions = [line(8, 150)];
    const gross = rate * 208;
    return {
      current: {
        salary_calc_mode: "HOURLY",
        currency,
        effective_from: e.date_of_joining,
        min_hours: 8,
        earnings,
        deductions,
        preview: { gross, deductions: 150, net: gross - 150 },
      },
    };
  }

  const basic = e.basic_salary;
  const housing = Math.round(basic * 0.25);
  const transport = Math.max(e.gross_salary - basic - housing, 0);
  const earnings = [
    line(1, basic),
    line(3, 25, "PERCENTAGE", housing),
    line(4, transport),
  ];
  const deductions = [];
  if (e.id === 7) deductions.push(line(6, Math.round(basic * 0.0975)));
  if (e.id === 3 || e.id === 12) deductions.push(line(7, 750));
  if (e.id === 10) deductions.push(line(8, 160));
  const totalDed = deductions.reduce((s, d) => s + d.resolved_amount, 0);
  const gross = basic + housing + transport;
  return {
    current: {
      salary_calc_mode: e.id === 10 ? "MONTHLY_HOURLY" : "MONTHLY_FIXED",
      currency,
      effective_from: e.date_of_joining,
      working_hours: e.id === 10 ? 9 : null,
      earnings,
      deductions,
      preview: { gross, deductions: totalDed, net: gross - totalDed },
    },
  };
};

const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const employeePayslips = (employeeId) => {
  const s = employeeSalary(employeeId).current;
  if (!s) return [];
  const months = [4, 5, 6, 7, 8, 9]; // Apr–Sep 2026
  let ytdGross = s.preview.gross * 3; // Jan–Mar already paid
  let ytdDed = s.preview.deductions * 3;
  const slips = months.map((m) => {
    const absence = m === 7 ? Math.round(s.preview.gross * 0.03) : 0;
    const gross = s.preview.gross;
    const ded = s.preview.deductions + absence;
    ytdGross += gross;
    ytdDed += ded;
    return {
      payslip_id: Number(employeeId) * 100 + m,
      period: { label: MONTH_LABELS[m - 1], year: 2026, month: m },
      totals: { gross_salary: gross, total_deductions: ded, net_salary: gross - ded },
      ytd: { gross: ytdGross, deductions: ytdDed, net: ytdGross - ytdDed, months: m },
      payslip_status: m === 9 && Number(employeeId) === 10 ? "HOLD" : "CREDITED",
      run_status: "COMPLETED",
    };
  });
  return slips.reverse(); // latest first
};

// ─────────────────────────────────────────────────────────────────────────────
// Projects tab
// ─────────────────────────────────────────────────────────────────────────────

const PAST_PROJECTS = [
  { id: 11, project_name: "Dubai Hills Mall Handover", project_code: "PRJ-011", project_location: "Dubai Hills", status: "COMPLETED", start_date: "2024-03-01", end_date: "2024-12-15" },
  { id: 12, project_name: "Al Maryah Tower Retrofit", project_code: "PRJ-012", project_location: "Abu Dhabi", status: "COMPLETED", start_date: "2025-01-10", end_date: "2025-06-30" },
  { id: 13, project_name: "KAFD Facilities Support", project_code: "PRJ-013", project_location: "Riyadh", status: "COMPLETED", start_date: "2025-07-01", end_date: "2025-12-31" },
];

export const employeeCurrentProjects = (employeeId) => {
  const e = getEmployeeRecord(employeeId);
  if (!e) return [];
  return (e.projects || []).map((p, i) => ({
    assignment_id: Number(employeeId) * 100 + p.id,
    project: p,
    start_date: i === 0 ? "2026-02-01" : "2026-05-18",
    end_date: null,
    is_active: true,
  }));
};

export const employeePastProjects = (employeeId) => {
  const n = Number(employeeId);
  if (n === 4 || n === 12) return [];
  const list = n % 2 === 0 ? PAST_PROJECTS.slice(0, 2) : PAST_PROJECTS;
  return list.map((p) => ({
    assignment_id: n * 1000 + p.id,
    project: p,
    start_date: p.start_date,
    end_date: p.end_date,
    is_active: false,
  }));
};

export const employeeProjectDetail = (employeeId, projectId) =>
  [...employeeCurrentProjects(employeeId), ...employeePastProjects(employeeId)].find(
    (a) => String(a.project?.id) === String(projectId),
  ) || null;

export const employeeProjectHistory = (employeeId) => {
  const current = employeeCurrentProjects(employeeId);
  const past = employeePastProjects(employeeId);
  const events = [];
  let id = 1;
  past.forEach((a) => {
    events.push({ id: id++, action: "ASSIGNED", project: { name: a.project.project_name }, actioned_at: a.start_date, actioned_by: "Fatima Al Zahra", notes: null });
    events.push({ id: id++, action: "REMOVED", project: { name: a.project.project_name }, actioned_at: a.end_date, actioned_by: "Fatima Al Zahra", notes: "Project handed over" });
  });
  current.forEach((a, i) => {
    if (i === 0 && past.length) {
      events.push({ id: id++, action: "MOVED_IN", project: { name: a.project.project_name }, previous_project: { name: past[past.length - 1].project.project_name }, actioned_at: a.start_date, actioned_by: "Omar Haddad", notes: "Transferred for fit-out phase" });
    } else {
      events.push({ id: id++, action: "ASSIGNED", project: { name: a.project.project_name }, actioned_at: a.start_date, actioned_by: "Omar Haddad", notes: null });
    }
  });
  return events.sort((a, b) => String(b.actioned_at).localeCompare(String(a.actioned_at)));
};

// ─────────────────────────────────────────────────────────────────────────────
// Attendance tab
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");
const HOLIDAYS = ["2026-12-02", "2026-12-03", "2026-03-20", "2026-05-27", "2026-05-28", "2026-06-16", "2026-08-25"];

// Deterministic per day + employee so the screen is stable.
const seeded = (a, b) => {
  const x = Math.sin(a * 9301 + b * 49297) * 233280;
  return x - Math.floor(x);
};

export const attendanceMonthLog = (employeeId, month) => {
  const [y, m] = String(month).split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const emp = Number(employeeId) || 1;
  const log = [];
  for (let d = 1; d <= days; d += 1) {
    const date = `${y}-${pad(m)}-${pad(d)}`;
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    let status;
    if (dow === 0 || dow === 6) status = "WEEKLY_OFF";
    else if (HOLIDAYS.includes(date)) status = "HOLIDAY";
    else if (dt > today) status = "FUTURE";
    else {
      const r = seeded(emp, y * 400 + m * 31 + d);
      status = r < 0.06 ? "ABSENT" : r < 0.12 ? "LEAVE" : r < 0.17 ? "INCOMPLETE" : "PRESENT";
    }
    const row = { date, status, check_in_time: null, check_out_time: null, total_minutes: 0, total_hours: 0, sessions: [] };
    if (status === "PRESENT" || status === "INCOMPLETE") {
      const r = seeded(d, emp);
      const inMin = 7 * 60 + 40 + Math.floor(r * 50); // 07:40–08:30
      const project = getEmployeeRecord(emp)?.projects?.[0]?.project_name || "Head Office";
      const checkIn = `${date}T${pad(Math.floor(inMin / 60))}:${pad(inMin % 60)}:00+04:00`;
      if (status === "PRESENT") {
        const outMin = inMin + 8 * 60 + 30 + Math.floor(seeded(emp, d) * 60);
        const lunchStart = 12 * 60 + 30;
        const checkOut = `${date}T${pad(Math.floor(outMin / 60))}:${pad(outMin % 60)}:00+04:00`;
        row.check_in_time = checkIn;
        row.check_out_time = checkOut;
        row.total_minutes = outMin - inMin - 30;
        row.sessions = [
          { check_in_time: checkIn, check_out_time: `${date}T${pad(Math.floor(lunchStart / 60))}:${pad(lunchStart % 60)}:00+04:00`, project_name: project },
          { check_in_time: `${date}T13:00:00+04:00`, check_out_time: checkOut, project_name: project },
        ];
      } else {
        row.check_in_time = checkIn;
        row.total_minutes = 0;
        row.sessions = [{ check_in_time: checkIn, check_out_time: null, project_name: project }];
      }
      row.total_hours = Math.round((row.total_minutes / 60) * 100) / 100;
    }
    log.push(row);
  }
  const worked = log.filter((r) => r.status === "PRESENT");
  const workingDays = log.filter((r) => !["WEEKLY_OFF", "HOLIDAY"].includes(r.status)).length;
  const totalMin = worked.reduce((s, r) => s + r.total_minutes, 0);
  const summary = {
    worked_hours: worked.length ? Math.round((totalMin / 60 / worked.length) * 10) / 10 : 0,
    hours_per_day: 8,
    present_days: worked.length,
    working_days: workingDays,
    total_leave_days: log.filter((r) => r.status === "LEAVE").length,
    late_days: worked.filter((r) => Number(r.check_in_time.slice(11, 13)) * 60 + Number(r.check_in_time.slice(14, 16)) > 8 * 60 + 15).length,
  };
  return { log, summary };
};

export const recentLeaveRequests = (employeeId) => {
  const n = Number(employeeId);
  if (n === 11) return [];
  return [
    { id: n * 10 + 1, leave_type: "Annual Leave", reason: "Family visit to home country", total_days: 5, status: "APPROVED" },
    { id: n * 10 + 2, leave_type: "Medical Leave", reason: "Viral fever — clinic certificate attached", total_days: 1, status: "APPROVED" },
    { id: n * 10 + 3, leave_type: "Annual Leave", reason: "Eid holidays extension", total_days: 2, status: "PENDING" },
  ];
};

// ─────────────────────────────────────────────────────────────────────────────
// Dependents tab
// ─────────────────────────────────────────────────────────────────────────────

const DEPENDENTS = {
  1: [
    { id: 1, full_name: "Rania Haddad", relationship: "SPOUSE", id_details: "Passport N4829173", date_of_birth: "1991-07-22", gender: "FEMALE", nationality: "Jordan", contact: "971501239876", status: "VERIFIED", document_url: "#", document_name: "rania_passport.pdf", photo_url: null },
    { id: 2, full_name: "Karim Haddad", relationship: "CHILD", id_details: "EID 784-2019-4417283-1", date_of_birth: "2019-03-14", gender: "MALE", nationality: "Jordan", contact: "", status: "PENDING", document_url: "#", document_name: "karim_birth_certificate.pdf", photo_url: null },
  ],
  3: [
    { id: 3, full_name: "Anjali Menon", relationship: "SPOUSE", id_details: "Passport Z5531842", date_of_birth: "1994-11-02", gender: "FEMALE", nationality: "India", contact: "971554418290", status: "PENDING", document_url: "#", document_name: "anjali_passport.pdf", photo_url: null },
    { id: 4, full_name: "Aarav Menon", relationship: "CHILD", id_details: "EID 784-2021-8832190-4", date_of_birth: "2021-06-09", gender: "MALE", nationality: "India", contact: "", status: "VERIFIED", document_url: null, document_name: null, photo_url: null },
    { id: 5, full_name: "Lakshmi Menon", relationship: "PARENT", id_details: "Passport M2240917", date_of_birth: "1962-01-18", gender: "FEMALE", nationality: "India", contact: "919847012345", status: "REJECTED", reject_reason: "Passport copy expired — please upload the renewed passport.", document_url: "#", document_name: "lakshmi_passport_old.pdf", photo_url: null },
  ],
  5: [
    { id: 6, full_name: "Mona Nasser", relationship: "SPOUSE", id_details: "Passport A1934820", date_of_birth: "1993-04-30", gender: "FEMALE", nationality: "Egypt", contact: "971526671180", status: "VERIFIED", document_url: "#", document_name: "mona_passport.pdf", photo_url: null },
  ],
  7: [
    { id: 7, full_name: "Noura Al Otaibi", relationship: "SPOUSE", id_details: "National ID 1098234771", date_of_birth: "1995-09-12", gender: "FEMALE", nationality: "Saudi Arabia", contact: "966501112233", status: "VERIFIED", document_url: null, document_name: null, photo_url: null },
    { id: 8, full_name: "Faisal Al Otaibi", relationship: "CHILD", id_details: "National ID 1123987654", date_of_birth: "2020-12-01", gender: "MALE", nationality: "Saudi Arabia", contact: "", status: "PENDING", document_url: "#", document_name: "faisal_family_card.pdf", photo_url: null },
  ],
};

export const dependentsFor = (employeeId) => (DEPENDENTS[Number(employeeId)] || []).map((d) => ({ ...d }));

// ─────────────────────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────────────────────

// Mutable catalog (Document Types admin screen creates/edits/deletes).
export const DOCUMENT_TYPES = [
  { id: 1, code: "PASSPORT", label: "Passport", category: "IDENTITY", description: "Valid passport, bio-data page", requires_expiry: true, requires_issuer: true, is_active: true, created_at: "2025-01-12T08:00:00Z" },
  { id: 2, code: "IQAMA", label: "Iqama (Residency Permit)", category: "IDENTITY", description: "Saudi residency permit", requires_expiry: true, requires_issuer: true, is_active: true, created_at: "2025-01-12T08:00:00Z" },
  { id: 3, code: "EMIRATES_ID", label: "Emirates ID", category: "IDENTITY", description: "UAE national identity card", requires_expiry: true, requires_issuer: true, is_active: true, created_at: "2025-01-12T08:00:00Z" },
  { id: 4, code: "WORK_PERMIT", label: "Work Permit", category: "LEGAL", description: "MOHRE / labour work permit", requires_expiry: true, requires_issuer: true, is_active: true, created_at: "2025-02-03T08:00:00Z" },
  { id: 5, code: "LABOUR_CONTRACT", label: "Labour Contract", category: "CONTRACT", description: "Signed employment contract", requires_expiry: false, requires_issuer: false, is_active: true, created_at: "2025-02-03T08:00:00Z" },
  { id: 6, code: "DRIVING_LICENSE", label: "Driving License", category: "IDENTITY", description: "RTA / Muroor driving licence", requires_expiry: true, requires_issuer: true, is_active: true, created_at: "2025-03-21T08:00:00Z" },
  { id: 7, code: "MEDICAL_FITNESS", label: "Medical Fitness Certificate", category: "PROFESSIONAL", description: "DHA / MOH medical fitness result", requires_expiry: true, requires_issuer: true, is_active: true, created_at: "2025-04-09T08:00:00Z" },
  { id: 8, code: "SAFETY_INDUCTION", label: "Site Safety Induction", category: "SITE", description: "HSE induction card for site access", requires_expiry: true, requires_issuer: false, is_active: true, created_at: "2025-05-14T08:00:00Z" },
  { id: 9, code: "DEGREE", label: "Degree Certificate", category: "PROFESSIONAL", description: "Attested education certificate", requires_expiry: false, requires_issuer: true, is_active: true, created_at: "2025-06-01T08:00:00Z" },
  { id: 10, code: "NDA", label: "Non-Disclosure Agreement", category: "LEGAL", description: "Confidentiality agreement", requires_expiry: false, requires_issuer: false, is_active: false, created_at: "2025-06-20T08:00:00Z" },
  { id: 11, code: "HEALTH_INSURANCE", label: "Health Insurance Card", category: "GENERAL", description: "Medical insurance card (Daman / Bupa)", requires_expiry: true, requires_issuer: true, is_active: true, created_at: "2025-07-02T08:00:00Z" },
];

// Shape of GET /document-types (grouped catalog): { data: { CATEGORY: [types] } }
export const groupedDocumentTypes = () => {
  const data = {};
  DOCUMENT_TYPES.filter((d) => d.is_active).forEach((d) => {
    (data[d.category] = data[d.category] || []).push(d);
  });
  return { data };
};

export const createDocumentType = (payload) => {
  const row = {
    id: nextId(DOCUMENT_TYPES),
    code: payload.code,
    label: payload.label,
    category: payload.category,
    description: payload.description,
    requires_expiry: !!payload.requires_expiry,
    requires_issuer: !!payload.requires_issuer,
    is_active: (payload.status || "ACTIVE") === "ACTIVE",
    created_at: new Date().toISOString(),
  };
  DOCUMENT_TYPES.unshift(row);
  return row;
};

export const updateDocumentType = (id, payload) => {
  const row = DOCUMENT_TYPES.find((d) => String(d.id) === String(id));
  if (row) Object.assign(row, payload);
  return row;
};

export const deleteDocumentType = (id) => {
  const idx = DOCUMENT_TYPES.findIndex((d) => String(d.id) === String(id));
  if (idx !== -1) DOCUMENT_TYPES.splice(idx, 1);
};

// VALID | EXPIRING (≤30 days) | EXPIRED — computed against today.
export const expiryStatusOf = (expiry) => {
  if (!expiry) return "VALID";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((new Date(expiry) - now) / 86400000);
  if (diff < 0) return "EXPIRED";
  if (diff <= 30) return "EXPIRING";
  return "VALID";
};

const docType = (id) => DOCUMENT_TYPES.find((d) => d.id === id);

let docSeq = 0;
const mkDoc = (employee_id, typeId, issue, expiry, extra = {}) => {
  docSeq += 1;
  const t = docType(typeId);
  return {
    id: docSeq,
    employee_id,
    document_type_id: typeId,
    type: { id: t.id, label: t.label, code: t.code },
    document_type: t.label,
    type_code: t.code,
    category: t.category,
    issue_date: issue,
    expiry_date: expiry,
    document_number: `${t.code.slice(0, 2)}${String(4820000 + employee_id * 1031 + typeId * 17)}`,
    issuing_authority: t.category === "IDENTITY" ? "ICP — Federal Authority for Identity" : t.category === "LEGAL" ? "MOHRE" : "Fyinder HR",
    file_name: `${t.code.toLowerCase()}_${employee_id}.pdf`,
    has_file: true,
    status: null,
    review_note: null,
    ...extra,
  };
};

// Legacy wizard row (no catalog type → icon/label from its enum code).
const mkLegacy = (employee_id, code, label, issue, expiry, category = "IDENTITY") => {
  docSeq += 1;
  return {
    id: docSeq,
    employee_id,
    document_type_id: null,
    type: null,
    document_type: label,
    type_code: code,
    category,
    issue_date: issue,
    expiry_date: expiry,
    document_number: `${code.slice(0, 1)}${String(7731000 + employee_id * 211)}`,
    issuing_authority: "Government of " + (employee_id % 2 ? "India" : "Pakistan"),
    file_name: `${code.toLowerCase()}_${employee_id}.jpg`,
    has_file: true,
    status: null,
    review_note: null,
  };
};

export const EMPLOYEE_DOCUMENTS = [
  mkDoc(1, 1, "2021-05-10", "2031-05-09"),
  mkDoc(1, 3, "2024-06-01", "2026-11-05"),
  mkDoc(1, 5, "2022-05-10", null, { status: "APPROVED" }),
  mkDoc(1, 9, "2012-07-01", null),
  mkDoc(2, 1, "2019-02-14", "2029-02-13"),
  mkDoc(2, 3, "2023-08-01", "2026-07-31"),
  mkDoc(2, 11, "2026-01-01", "2026-12-31"),
  mkDoc(3, 1, "2020-11-03", "2030-11-02"),
  mkDoc(3, 3, "2025-01-16", "2027-01-15"),
  mkDoc(3, 4, "2025-01-16", "2027-01-15"),
  mkDoc(3, 7, "2026-09-20", "2027-09-19", { status: "PENDING" }),
  mkLegacy(3, "DRIVER_LICENSE", "Driver License", "2023-03-02", "2026-10-28"),
  mkDoc(4, 1, "2022-04-18", "2032-04-17"),
  mkDoc(4, 3, "2023-06-01", "2026-05-31"),
  mkDoc(4, 5, "2023-06-01", null, { status: "APPROVED" }),
  mkDoc(4, 11, "2026-02-01", "2027-01-31", { status: "PENDING" }),
  mkDoc(5, 1, "2018-09-09", "2028-09-08"),
  mkDoc(5, 3, "2024-03-20", "2026-11-12"),
  mkDoc(5, 9, "2014-06-30", null, { status: "REJECTED", review_note: "Attestation stamp is not visible — please re-upload." }),
  mkDoc(6, 1, "2023-12-01", "2033-11-30"),
  mkDoc(6, 4, "2024-01-08", "2026-01-07"),
  mkDoc(6, 7, "2026-10-02", "2027-10-01", { status: "PENDING" }),
  mkDoc(7, 2, "2023-09-11", "2027-09-10"),
  mkDoc(7, 8, "2026-03-01", "2027-02-28"),
  mkDoc(7, 6, "2022-05-05", "2026-11-04"),
  mkDoc(8, 1, "2024-04-01", "2034-03-31"),
  mkDoc(8, 3, "2024-04-15", "2026-04-14"),
  mkLegacy(9, "PASSPORT", "Passport", "2019-07-20", "2029-07-19"),
  mkDoc(9, 4, "2025-02-03", "2027-02-02"),
  mkDoc(9, 8, "2025-02-10", "2026-02-09"),
  mkDoc(9, 7, "2025-02-01", "2026-11-01", { status: "PENDING" }),
  mkDoc(10, 1, "2020-01-15", "2030-01-14"),
  mkDoc(10, 4, "2025-03-17", "2027-03-16"),
  mkDoc(10, 8, "2025-03-20", "2026-10-30"),
  mkDoc(11, 1, "2017-08-08", "2027-08-07"),
  mkDoc(11, 3, "2023-11-01", "2025-10-31"),
  mkDoc(12, 1, "2021-10-10", "2031-10-09"),
  mkDoc(12, 2, "2024-07-22", "2026-11-20"),
  mkDoc(12, 8, "2024-08-01", "2025-07-31"),
  mkDoc(12, 5, "2024-07-22", null, { status: "PENDING" }),
];

const withExpiry = (d) => ({ ...d, expiry_status: expiryStatusOf(d.expiry_date) });

export const docsForEmployee = (employeeId) =>
  EMPLOYEE_DOCUMENTS.filter((d) => String(d.employee_id) === String(employeeId)).map(withExpiry);

export const getDocument = (id) => EMPLOYEE_DOCUMENTS.find((d) => String(d.id) === String(id)) || null;

export const updateDocument = (id, patch) => {
  const d = getDocument(id);
  if (d) Object.assign(d, patch);
  return d;
};

export const deleteDocument = (id) => {
  const idx = EMPLOYEE_DOCUMENTS.findIndex((d) => String(d.id) === String(id));
  if (idx !== -1) EMPLOYEE_DOCUMENTS.splice(idx, 1);
};

// Upload a new document, or replace an existing one (keeps its type).
export const uploadDocument = ({ employeeId, documentTypeId, replaceDocumentId, issueDate, expiryDate, issuingAuthority, documentNumber, fileName, status }) => {
  const replaced = replaceDocumentId ? getDocument(replaceDocumentId) : null;
  const typeId = replaced ? replaced.document_type_id : Number(documentTypeId);
  const t = typeId ? docType(typeId) : null;
  docSeq = Math.max(docSeq, nextId(EMPLOYEE_DOCUMENTS) - 1) + 1;
  const row = {
    id: docSeq,
    employee_id: Number(employeeId) || employeeId,
    document_type_id: typeId || null,
    type: t ? { id: t.id, label: t.label, code: t.code } : replaced?.type || null,
    document_type: t ? t.label : replaced?.document_type || "Document",
    type_code: t ? t.code : replaced?.type_code || "OTHER",
    category: t ? t.category : replaced?.category || "GENERAL",
    issue_date: issueDate || null,
    expiry_date: expiryDate || null,
    document_number: documentNumber || null,
    issuing_authority: issuingAuthority || null,
    file_name: fileName || "document.pdf",
    has_file: true,
    status: status === undefined ? null : status,
    review_note: null,
  };
  if (replaced) deleteDocument(replaced.id);
  EMPLOYEE_DOCUMENTS.unshift(row);
  return withExpiry(row);
};

// Shape of the document dashboard summary (one row per employee + stats).
export const documentSummary = ({ search = "", type = "all", status = "all" } = {}) => {
  const all = EMPLOYEE_DOCUMENTS.map(withExpiry);
  const STATUS = { valid: "VALID", expiring: "EXPIRING", expired: "EXPIRED" };
  const rows = EMPLOYEE_RECORDS.map((e) => {
    let docs = all.filter((d) => d.employee_id === e.id);
    if (type !== "all") docs = docs.filter((d) => String(d.document_type_id) === String(type));
    if (status !== "all") docs = docs.filter((d) => d.expiry_status === STATUS[status]);
    return {
      employee_id: e.id,
      employee_name: e.full_name,
      profile_url: e.profile_url,
      department: e.department_name,
      role: e.roles?.[0]?.name,
      total_documents: docs.length,
      pending: docs.filter((d) => d.status === "PENDING").length,
      expiring: docs.filter((d) => d.expiry_status === "EXPIRING").length,
      _hasMatch: docs.length > 0,
    };
  }).filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !r.employee_name.toLowerCase().includes(q)) return false;
    if ((type !== "all" || status !== "all") && !r._hasMatch) return false;
    return true;
  });
  return {
    rows,
    dashboard_stats: {
      total_documents: all.length,
      valid_documents: all.filter((d) => d.expiry_status === "VALID").length,
      expiring_soon: all.filter((d) => d.expiry_status === "EXPIRING").length,
      expired_documents: all.filter((d) => d.expiry_status === "EXPIRED").length,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Profile (Personal / Work information of the signed-in user)
// ─────────────────────────────────────────────────────────────────────────────

export const myProfile = () => {
  const user = getStaticUser();
  const rec = currentEmployeeRecord();
  if (rec) {
    return {
      full_name: rec.full_name,
      phone_number: rec.phone_number,
      email: rec.email,
      dob: rec.date_of_birth,
      nationality: rec.nationality,
      gender: rec.gender,
      address: rec.address,
      profile_url: rec.profile_url,
      employee_id: rec.country_emp_id,
      department: rec.department_name,
      designation: rec.designation_name,
      project: rec.projects?.[0]?.project_name || null,
      date_of_joining: rec.date_of_joining,
      employment_type: rec.employment_type,
      access_level: rec.access_level,
    };
  }
  return {
    full_name: user?.name || "",
    phone_number: "+971501234567",
    email: user?.email || "",
    dob: "1984-02-09",
    nationality: "United Arab Emirates",
    gender: "MALE",
    address: "Office 2301, Bay Square 5, Business Bay, Dubai",
    profile_url: user?.profile_image || null,
    employee_id: "EMP-0000",
    department: "Management",
    designation: "Managing Director",
    project: PROJECTS[0].name,
    date_of_joining: "2021-01-03",
    employment_type: "FULL_TIME",
    access_level: "SUPER_ADMIN",
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Invitations / collaboration (multi-company projects)
// ─────────────────────────────────────────────────────────────────────────────

const ME = { employer_id: 1, name: "Fyinder Technologies LLC" };

export const PARTNER_COMPANIES = [
  { employerId: 101, name: "Al Habtoor Engineering Consultants", email: "projects@alhabtoor-eng.ae" },
  { employerId: 102, name: "Arabtec Construction", email: "tenders@arabtec.ae" },
  { employerId: 103, name: "Gulf Steel Works", email: "projects@gulfsteel.ae" },
  { employerId: 104, name: "Emirates MEP Services", email: "ops@emiratesmep.ae" },
  { employerId: 105, name: "Saudi Binladin Group", email: "contracts@sbg.com.sa" },
  { employerId: 106, name: "Khatib & Alami", email: "dubai@khatibalami.com" },
  { employerId: 107, name: "Dar Al Handasah", email: "bd@dar.com" },
  { employerId: 108, name: "Drake & Scull", email: "projects@drakescull.ae" },
  { employerId: 109, name: "Al Futtaim Engineering", email: "afe@alfuttaim.ae" },
];

export const searchCompanies = (q) => {
  const s = String(q || "").trim().toLowerCase();
  if (s.length < 2) return [];
  return PARTNER_COMPANIES.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s));
};

// Projects the acting company can invite on, with its role on each.
export const INVITABLE_PROJECTS = [
  { id: 1, name: PROJECTS[0].name, myRole: "OWNER" },
  { id: 2, name: PROJECTS[1].name, myRole: "OWNER" },
  { id: 3, name: PROJECTS[2].name, myRole: "OWNER" },
  { id: 5, name: "Jeddah Tower Podium", myRole: "CONSULTANT" },
  { id: 6, name: "NEOM Logistics Hub", myRole: "EPC" },
];

const company = (id) => PARTNER_COMPANIES.find((c) => c.employerId === id);
const node = (id, role, children = []) => ({ employer_id: id, name: company(id).name, role, children });

export const COLLAB_TREES = {
  1: { project_name: PROJECTS[0].name, tree: { ...ME, role: "OWNER", children: [node(101, "CONSULTANT", [node(102, "EPC", [node(103, "SUBCONTRACTOR"), node(104, "SUBCONTRACTOR")])])] } },
  2: { project_name: PROJECTS[1].name, tree: { ...ME, role: "OWNER", children: [node(106, "CONSULTANT", [node(109, "EPC")])] } },
  3: { project_name: PROJECTS[2].name, tree: { ...ME, role: "OWNER", children: [node(105, "EPC", [node(108, "SUBCONTRACTOR")])] } },
  5: { project_name: "Jeddah Tower Podium", tree: { ...ME, role: "CONSULTANT", children: [] } },
  6: { project_name: "NEOM Logistics Hub", tree: { ...ME, role: "EPC", children: [node(103, "SUBCONTRACTOR")] } },
};

const findNodes = (n, pred, acc = []) => {
  if (pred(n)) acc.push(n);
  (n.children || []).forEach((c) => findNodes(c, pred, acc));
  return acc;
};

export const eligibleParents = (projectId, role) => {
  const tree = COLLAB_TREES[projectId]?.tree;
  if (!tree) return [];
  const parentRole = role === "EPC" ? "CONSULTANT" : "EPC";
  return findNodes(tree, (n) => n.role === parentRole).map((n) => ({ employerId: n.employer_id, name: n.name }));
};

export const INVITATIONS = {
  received: [
    { id: 1, invitingCompany: { name: "Nakheel Properties" }, role: "CONSULTANT", project: "Palm Jebel Ali Villas", projectId: 7, parentCompany: null, status: "PENDING", parentApprovalStatus: "NOT_REQUIRED" },
    { id: 2, invitingCompany: { name: "Red Sea Global" }, role: "EPC", project: "NEOM Logistics Hub", projectId: 6, parentCompany: { name: "Khatib & Alami" }, status: "ACCEPTED", parentApprovalStatus: "PENDING" },
    { id: 3, invitingCompany: { name: "Jeddah Economic Company" }, role: "CONSULTANT", project: "Jeddah Tower Podium", projectId: 5, parentCompany: null, status: "ACCEPTED", parentApprovalStatus: "NOT_REQUIRED" },
    { id: 4, invitingCompany: { name: "Aldar Properties" }, role: "SUBCONTRACTOR", project: "Saadiyat Grove Residences", projectId: 8, parentCompany: { name: "Arabtec Construction" }, status: "DECLINED", parentApprovalStatus: "NOT_REQUIRED" },
    { id: 5, invitingCompany: { name: "ROSHN Real Estate" }, role: "CONSULTANT", project: "Sedra Community Phase 3", projectId: 9, parentCompany: null, status: "EXPIRED", parentApprovalStatus: "NOT_REQUIRED" },
    { id: 6, invitingCompany: { name: "Meraas Holding" }, role: "EPC", project: "Bluewaters Promenade Upgrade", projectId: 10, parentCompany: { name: "Dar Al Handasah" }, status: "PENDING", parentApprovalStatus: "PENDING" },
  ],
  sent: [
    { id: 11, invitedCompany: { name: company(101).name }, role: "CONSULTANT", project: PROJECTS[0].name, projectId: 1, status: "ACCEPTED", parentApprovalStatus: "NOT_REQUIRED" },
    { id: 12, invitedCompany: { name: company(102).name }, role: "EPC", project: PROJECTS[0].name, projectId: 1, status: "ACCEPTED", parentApprovalStatus: "APPROVED" },
    { id: 13, invitedCompany: null, invitedEmail: "projects@gulfsteel.ae", role: "SUBCONTRACTOR", project: PROJECTS[1].name, projectId: 2, status: "PENDING", parentApprovalStatus: "PENDING", inviteLink: "https://hrms.fyinder.com/invite/8f3a2c91d4" },
    { id: 14, invitedCompany: { name: company(105).name }, role: "EPC", project: PROJECTS[2].name, projectId: 3, status: "PENDING", parentApprovalStatus: "NOT_REQUIRED", inviteLink: "https://hrms.fyinder.com/invite/1b77e0aa52" },
    { id: 15, invitedCompany: { name: company(107).name }, role: "CONSULTANT", project: PROJECTS[1].name, projectId: 2, status: "DECLINED", parentApprovalStatus: "NOT_REQUIRED" },
    { id: 16, invitedCompany: { name: company(108).name }, role: "SUBCONTRACTOR", project: PROJECTS[0].name, projectId: 1, status: "CANCELLED", parentApprovalStatus: "NOT_REQUIRED" },
  ],
  approvals: [
    { id: 21, invitedCompany: { name: company(103).name }, role: "SUBCONTRACTOR", project: "NEOM Logistics Hub", projectId: 6 },
    { id: 22, invitedCompany: { name: company(104).name }, role: "SUBCONTRACTOR", project: "NEOM Logistics Hub", projectId: 6 },
  ],
  collaborations: [
    { projectId: 1, projectName: PROJECTS[0].name, myRole: "OWNER", invitedBy: null, parents: [], children: [{ id: 101, name: company(101).name, role: "CONSULTANT" }, { id: 102, name: company(102).name, role: "EPC" }] },
    { projectId: 2, projectName: PROJECTS[1].name, myRole: "OWNER", invitedBy: null, parents: [], children: [{ id: 106, name: company(106).name, role: "CONSULTANT" }] },
    { projectId: 3, projectName: PROJECTS[2].name, myRole: "OWNER", invitedBy: null, parents: [], children: [{ id: 105, name: company(105).name, role: "EPC" }] },
    { projectId: 5, projectName: "Jeddah Tower Podium", myRole: "CONSULTANT", invitedBy: { name: "Jeddah Economic Company" }, parents: [{ id: 201, name: "Jeddah Economic Company", role: "OWNER" }], children: [] },
    { projectId: 6, projectName: "NEOM Logistics Hub", myRole: "EPC", invitedBy: { name: "Red Sea Global" }, parents: [{ id: 106, name: company(106).name, role: "CONSULTANT" }], children: [{ id: 103, name: company(103).name, role: "SUBCONTRACTOR" }] },
  ],
};

export const invitationCounts = () => ({
  received: INVITATIONS.received.filter((r) => r.status === "PENDING").length,
  approvals: INVITATIONS.approvals.length,
});

// Accept / decline / cancel / parent approve / parent reject.
export const invitationAction = (kind, id) => {
  const find = (list) => list.find((r) => String(r.id) === String(id));
  if (kind === "accept") {
    const r = find(INVITATIONS.received);
    if (r) r.status = "ACCEPTED";
  } else if (kind === "decline") {
    const r = find(INVITATIONS.received);
    if (r) r.status = "DECLINED";
  } else if (kind === "cancel") {
    const r = find(INVITATIONS.sent);
    if (r) r.status = "CANCELLED";
  } else if (kind === "approve" || kind === "reject") {
    const idx = INVITATIONS.approvals.findIndex((r) => String(r.id) === String(id));
    if (idx !== -1) INVITATIONS.approvals.splice(idx, 1);
  }
};

export const createInvitations = ({ role, projectIds, invitedEmployerId, invitedEmail, parentEmployerId }) => {
  const invited = invitedEmployerId ? company(invitedEmployerId) : null;
  projectIds.forEach((pid) => {
    const p = INVITABLE_PROJECTS.find((x) => x.id === pid);
    const id = nextId(INVITATIONS.sent.concat(INVITATIONS.received, INVITATIONS.approvals));
    INVITATIONS.sent.unshift({
      id,
      invitedCompany: invited ? { name: invited.name } : null,
      invitedEmail: invited ? undefined : invitedEmail,
      role,
      project: p?.name,
      projectId: pid,
      status: "PENDING",
      parentApprovalStatus: parentEmployerId ? "PENDING" : "NOT_REQUIRED",
      inviteLink: invited ? undefined : `https://hrms.fyinder.com/invite/${(id * 2654435761).toString(16).slice(0, 10)}`,
    });
  });
};

// ── Project collaboration roles ──
export const ROLE_CATALOG = [
  { key: "ATTENDANCE", label: "Attendance" },
  { key: "TIMESHEET", label: "Timesheets" },
  { key: "EMPLOYEE", label: "Employees" },
  { key: "DOCUMENT", label: "Documents" },
  { key: "OVERTIME", label: "Overtime" },
  { key: "LEAVE", label: "Leave" },
];

const perm = (module_key, r, c, u, d) => ({ module_key, can_read: r, can_create: c, can_update: u, can_delete: d });

export const PROJECT_ROLES = [
  { id: 1, project_id: 1, name: "Site Consultant", description: "Reviews attendance and documents of deployed staff", is_active: true, permissions: [perm("ATTENDANCE", true, false, false, false), perm("DOCUMENT", true, false, false, false), perm("EMPLOYEE", true, false, false, false)] },
  { id: 2, project_id: 1, name: "Main Contractor Supervisor", description: "Manages timesheets and overtime on site", is_active: true, permissions: [perm("ATTENDANCE", true, true, true, false), perm("TIMESHEET", true, true, true, true), perm("OVERTIME", true, true, true, false)] },
  { id: 3, project_id: 1, name: "Read-only Auditor", description: "", is_active: false, permissions: [] },
  { id: 4, project_id: 2, name: "MEP Coordinator", description: "Attendance and leave visibility for MEP partners", is_active: true, permissions: [perm("ATTENDANCE", true, false, false, false), perm("LEAVE", true, false, false, false)] },
];

export const projectRolesFor = (projectId) =>
  PROJECT_ROLES.filter((r) => String(r.project_id) === String(projectId)).map((r) => ({ ...r, permissions: r.permissions.map((p) => ({ ...p })) }));

export const saveProjectRole = (projectId, { id, name, description, permissions }) => {
  if (id) {
    const r = PROJECT_ROLES.find((x) => x.id === id);
    if (r) Object.assign(r, { name, description, permissions });
    return r;
  }
  const role = { id: nextId(PROJECT_ROLES), project_id: Number(projectId), name, description, is_active: true, permissions };
  PROJECT_ROLES.push(role);
  return role;
};

export const deleteProjectRole = (id) => {
  const idx = PROJECT_ROLES.findIndex((r) => r.id === id);
  if (idx !== -1) PROJECT_ROLES.splice(idx, 1);
};

// ── Partner drill-in (shared projects + deployed employees) ──
export const sharedProjectsFor = (employerId) =>
  Object.entries(COLLAB_TREES)
    .filter(([, t]) => findNodes(t.tree, (n) => n.employer_id === employerId && n !== t.tree).length)
    .map(([pid, t]) => ({ id: Number(pid), project_name: t.project_name }));

const PARTNER_NAMES = [
  "Abdul Rahman Khan", "Suresh Kumar", "Mohammed Rafiq", "Ramesh Thapa", "Jomar Dela Cruz", "Ahmed Saeed",
  "Pradeep Nair", "Tariq Mahmood", "Bikash Gurung", "Arnel Santos", "Hassan Ali", "Vijay Pillai",
];
const PARTNER_ROLES = ["Site Engineer", "Foreman", "Electrician", "Pipe Fitter", "Steel Fixer", "HSE Officer", "Surveyor"];

export const deployedEmployees = (employerId, projectId) => {
  const count = 5 + ((employerId + Number(projectId)) % 6);
  const proj = COLLAB_TREES[projectId]?.project_name || "—";
  return Array.from({ length: count }, (_, i) => {
    const name = PARTNER_NAMES[(employerId + i * 5) % PARTNER_NAMES.length];
    const id = employerId * 100 + Number(projectId) * 10 + i;
    return {
      id,
      full_name: name,
      country_emp_id: `P${employerId}-${String(i + 1).padStart(3, "0")}`,
      roles: [{ name: PARTNER_ROLES[(i + employerId) % PARTNER_ROLES.length] }],
      employment_type: i % 3 === 0 ? "CONTRACT" : "FULL_TIME",
      user_status: i === count - 1 ? "INACTIVE" : "ACTIVE",
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${(company(employerId)?.email || "partner.ae").split("@")[1]}`,
      phone_number: `+97155${String(3000000 + id * 37).slice(0, 7)}`,
      projects: [{ project_name: proj }],
      main_project_id: Number(projectId),
    };
  });
};

export const partnerAttendanceSummary = (employeeId, month) => {
  const [y, m] = String(month).split("-").map(Number);
  const r = seeded(Number(employeeId), y * 12 + m);
  const working = 22;
  const absent = Math.floor(r * 3);
  const leave = Math.floor(seeded(m, Number(employeeId)) * 3);
  const present = working - absent - leave;
  return { working_days: working, present_days: present, absent_days: absent, paid_leave_days: leave, worked_hours: present * 9 };
};

