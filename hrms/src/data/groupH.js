// Static data for the employee self-service portal and the staffing-company
// portal (group H). Builds on the shared entities in common.js.
import { EMPLOYEES, PROJECTS, employeeById } from "./common";

const ME = employeeById(4); // Sara Khan — the logged-in employee

// ─── Approval inbox ────────────────────────────────────────────────────────
const lvls = (spec) =>
  spec.map(([level_no, approved, total, pending]) => ({ level_no, approved, total, pending }));

export const APPROVAL_INBOX = [
  { approval_request_id: 101, entity_type: "LEAVE_REQUEST", employee_name: "Rahul Menon", leave_type: "Annual Leave", from_date: "2026-10-26", to_date: "2026-10-30", total_days: 5, current_level: 1, levels_summary: lvls([[1, 0, 1, 1], [2, 0, 1, 1]]), can_act: true, can_reject: true },
  { approval_request_id: 102, entity_type: "OVERTIME_REQUEST", employee_name: "Khalid Al Otaibi", work_date: "2026-10-14", start_time: "18:00", end_time: "21:30", overtime_hours: 3.5, current_level: 1, levels_summary: lvls([[1, 0, 1, 1]]), can_act: true, can_reject: true },
  { approval_request_id: 103, entity_type: "ATTENDANCE_CORRECTION", employee_name: "Maria Santos", work_date: "2026-10-12", check_in_time: "08:55", check_out_time: "18:05", current_level: 2, levels_summary: lvls([[1, 1, 1, 0], [2, 0, 1, 1]]), can_act: true, can_reject: true },
  { approval_request_id: 104, entity_type: "LEAVE_ENCASHMENT", employee_name: "Youssef Nasser", leave_type: "Annual Leave", payout_month: "2026-11", total_days: 6, amount: 2769.23, currency: "AED", current_level: 1, levels_summary: lvls([[1, 0, 1, 1], [2, 0, 1, 1]]), can_act: true, can_reject: true },
  { approval_request_id: 105, entity_type: "LEAVE_REQUEST", employee_name: "Imran Sheikh", leave_type: "Sick Leave", from_date: "2026-09-21", to_date: "2026-09-22", total_days: 2, current_level: 1, levels_summary: lvls([[1, 0, 1, 1]]), can_act: false, can_reject: true },
  { approval_request_id: 106, entity_type: "OVERTIME_REQUEST", employee_name: "Bilal Ahmed", work_date: "2026-10-15", start_time: "17:30", end_time: "20:00", overtime_hours: 2.5, current_level: 2, levels_summary: lvls([[1, 1, 1, 0], [2, 0, 1, 1]]), can_act: false, can_reject: false },
  { approval_request_id: 107, entity_type: "LOAN_REQUEST", employee_name: "Joseph Mathew", current_level: 1, levels_summary: lvls([[1, 0, 2, 2]]), can_act: true, can_reject: true },
];

// ─── Holidays (UAE public + company) ───────────────────────────────────────
export const HOLIDAYS = [
  { id: 1, holiday_name: "New Year's Day", holiday_date: "2026-01-01", holiday_type: "Public Holiday", description: "Gregorian new year" },
  { id: 2, holiday_name: "Eid Al Fitr", holiday_date: "2026-03-20", holiday_type: "Public Holiday", description: "End of Ramadan" },
  { id: 3, holiday_name: "Eid Al Fitr Holiday", holiday_date: "2026-03-21", holiday_type: "Public Holiday", description: "End of Ramadan" },
  { id: 4, holiday_name: "Arafat Day", holiday_date: "2026-05-26", holiday_type: "Public Holiday", description: "Day of Arafah" },
  { id: 5, holiday_name: "Eid Al Adha", holiday_date: "2026-05-27", holiday_type: "Public Holiday", description: "Feast of Sacrifice" },
  { id: 6, holiday_name: "Islamic New Year", holiday_date: "2026-06-16", holiday_type: "Public Holiday", description: "Hijri new year" },
  { id: 7, holiday_name: "Prophet's Birthday", holiday_date: "2026-08-25", holiday_type: "Public Holiday", description: "Mawlid" },
  { id: 8, holiday_name: "Company Foundation Day", holiday_date: "2026-10-28", holiday_type: "Company Holiday", description: "Fyinder anniversary" },
  { id: 9, holiday_name: "Commemoration Day", holiday_date: "2026-11-30", holiday_type: "Public Holiday", description: "Martyrs' Day" },
  { id: 10, holiday_name: "UAE National Day", holiday_date: "2026-12-02", holiday_type: "Public Holiday", description: "National Day" },
  { id: 11, holiday_name: "National Day Holiday", holiday_date: "2026-12-03", holiday_type: "Public Holiday", description: "National Day" },
  { id: 12, holiday_name: "Year-end Optional Day", holiday_date: "2026-12-31", holiday_type: "Optional Holiday", description: "Optional leave day" },
];

// ─── My leave balances (shape of GET /leaves/my-balances) ──────────────────
export const MY_LEAVE_BALANCES = {
  data: {
    balance_year: 2026,
    total_available_balance: 27.5,
    leave_balances: [
      { balance_id: 1, id: 1, leave_type_id: 1, name: "Annual Leave", code: "AL", allocated: 30, used: 12, balance: 18, pending: 5, carry_forward: 6, carry_forward_used: 2, carry_forward_expires_on: "2026-12-31" },
      { balance_id: 2, id: 2, leave_type_id: 2, name: "Sick Leave", code: "SL", allocated: 15, used: 3, balance: 12, pending: 0, carry_forward: 0 },
      { balance_id: 3, id: 3, leave_type_id: 3, name: "Hajj Leave", code: "HL", allocated: 30, used: 30, balance: 0, pending: 0, carry_forward: 0 },
      { balance_id: 4, id: 4, leave_type_id: 4, name: "Compassionate Leave", code: "CL", allocated: 5, used: 1.5, balance: 3.5, pending: 0, carry_forward: 0 },
      { balance_id: 5, id: 5, leave_type_id: 5, name: "Unpaid Leave", code: "UL", allocated: 0, used: 2, balance: 0, pending: 0, carry_forward: 0 },
    ],
  },
};

// ─── Employee dashboard ────────────────────────────────────────────────────
export const EMPLOYEE_DASHBOARD_STATS = {
  daysPresent: 12,
  workingDays: 13,
  overtimeHours: 6.5,
  loading: false,
};

export const EMPLOYEE_RECENT_REQUESTS = [
  { id: "l-31", type: "Annual Leave", typeKey: "employeeDashboard.requestTypes.leave", dateStr: "Oct 20 - Oct 22", status: "PENDING", timestamp: Date.parse("2026-10-20") },
  { id: "o-12", typeKey: "employeeDashboard.requestTypes.overtime", dateStr: "Oct 16", isOvertime: true, hours: 2.5, status: "APPROVED", timestamp: Date.parse("2026-10-16") },
  { id: "c-7", typeKey: "employeeDashboard.requestTypes.correction", dateStr: "Oct 14", status: "REJECTED", timestamp: Date.parse("2026-10-14") },
  { id: "l-29", type: "Sick Leave", typeKey: "employeeDashboard.requestTypes.leave", dateStr: "Oct 13 - Oct 13", status: "APPROVED", timestamp: Date.parse("2026-10-13") },
  { id: "o-11", typeKey: "employeeDashboard.requestTypes.overtime", dateStr: "Oct 12", isOvertime: true, hours: 4, status: "PENDING", timestamp: Date.parse("2026-10-12") },
];

export const nextHolidayFrom = (today) =>
  HOLIDAYS.filter((h) => h.holiday_date >= today).sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))[0] || null;

// ─── My leave requests (Sara Khan) ─────────────────────────────────────────
export const MY_LEAVE_TYPES = [
  { id: 1, leave_name: "Annual Leave" },
  { id: 2, leave_name: "Sick Leave" },
  { id: 3, leave_name: "Hajj Leave" },
  { id: 4, leave_name: "Compassionate Leave" },
  { id: 5, leave_name: "Unpaid Leave" },
];

export const MY_LEAVES = [
  { id: 31, employee_name: ME.full_name, leave_type: "Annual Leave", from_date: "2026-10-20", to_date: "2026-10-22", total_days: 3, status: "PENDING", reason: "Family visit to Lahore" },
  { id: 29, employee_name: ME.full_name, leave_type: "Sick Leave", from_date: "2026-10-13", to_date: "2026-10-13", total_days: 1, status: "APPROVED", reason: "Fever, medical certificate attached" },
  { id: 27, employee_name: ME.full_name, leave_type: "Annual Leave", from_date: "2026-11-09", to_date: "2026-11-12", total_days: 4, status: "APPROVED", reason: "Short trip to Muscat" },
  { id: 24, employee_name: ME.full_name, leave_type: "Compassionate Leave", from_date: "2026-09-02", to_date: "2026-09-03", total_days: 1.5, status: "APPROVED", reason: "Family bereavement" },
  { id: 21, employee_name: ME.full_name, leave_type: "Annual Leave", from_date: "2026-08-10", to_date: "2026-08-14", total_days: 5, status: "REJECTED", reason: "Summer holiday — clashed with payroll close" },
  { id: 18, employee_name: ME.full_name, leave_type: "Sick Leave", from_date: "2026-06-22", to_date: "2026-06-23", total_days: 2, status: "APPROVED", reason: "Dental surgery" },
  { id: 15, employee_name: ME.full_name, leave_type: "Unpaid Leave", from_date: "2026-05-04", to_date: "2026-05-05", total_days: 2, status: "CANCELLED", reason: "Personal errands" },
  { id: 12, employee_name: ME.full_name, leave_type: "Annual Leave", from_date: "2026-03-22", to_date: "2026-03-26", total_days: 4, status: "APPROVED", reason: "Eid holidays extension" },
];

// ─── My exit visas ─────────────────────────────────────────────────────────
export const MY_VISAS = [
  { id: 9, visa_type: "MULTIPLE_EXIT", visa_number: "EV-2026-0912", valid_from: "2026-07-01", valid_until: "2026-12-31", exits_used: 1, max_exits: 4, exits_remaining: 3, status: "ACTIVE",
    trips: [
      { id: 21, departure_date: "2026-08-04", expected_return_date: "2026-08-18", actual_return_date: "2026-08-17", status: "RETURNED" },
      { id: 22, departure_date: "2026-11-09", expected_return_date: "2026-11-12", actual_return_date: null, status: "PLANNED" },
    ] },
  { id: 8, visa_type: "SINGLE_EXIT", visa_number: null, requested_from: "2026-12-20", requested_to: "2027-01-05", valid_from: null, valid_until: null, exits_used: 0, max_exits: 1, exits_remaining: 1, status: "PENDING_APPROVAL", trips: [] },
  { id: 7, visa_type: "SINGLE_EXIT", visa_number: "EV-2026-0544", valid_from: "2026-05-20", valid_until: "2026-06-30", exits_used: 1, max_exits: 1, exits_remaining: 0, status: "EXHAUSTED",
    trips: [{ id: 15, departure_date: "2026-05-25", expected_return_date: "2026-06-05", actual_return_date: "2026-06-05", status: "RETURNED" }] },
  { id: 6, visa_type: "MULTIPLE_EXIT", visa_number: null, valid_from: null, valid_until: null, exits_used: 0, max_exits: 3, exits_remaining: 3, status: "REJECTED", rejection_reason: "Overlaps with year-end audit period", trips: [] },
  { id: 5, visa_type: "SINGLE_EXIT", visa_number: "EV-2026-0210", valid_from: "2026-03-15", valid_until: "2026-04-15", exits_used: 1, max_exits: 1, exits_remaining: 0, status: "EXPIRED",
    trips: [{ id: 9, departure_date: "2026-03-19", expected_return_date: "2026-03-27", actual_return_date: "2026-03-28", status: "RETURNED" }] },
  { id: 4, visa_type: "SINGLE_EXIT", visa_number: "EV-2026-0101", valid_from: "2026-02-01", valid_until: "2026-02-28", exits_used: 0, max_exits: 1, exits_remaining: 1, status: "CANCELLED", trips: [] },
  { id: 3, visa_type: "SINGLE_EXIT", visa_number: "EV-2026-0098", valid_from: "2026-10-10", valid_until: "2026-11-10", exits_used: 0, max_exits: 1, exits_remaining: 1, status: "APPROVED", trips: [] },
];

// ─── My payslips (Jan–Sep 2026, newest first) ──────────────────────────────
const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const buildPayslip = (month, { overtime = 0, bonus = 0, unpaid = 0, loan = 0 } = {}) => {
  const earnings = [
    { id: `b-${month}`, label: "Basic Salary", amount: 9000 },
    { id: `h-${month}`, label: "Housing Allowance", amount: 2500 },
    { id: `t-${month}`, label: "Transport Allowance", amount: 1000 },
    { id: `o-${month}`, label: "Other Allowance", amount: 500 },
  ];
  const incentives = [];
  if (overtime) incentives.push({ id: `ot-${month}`, label: "Overtime", amount: overtime });
  if (bonus) incentives.push({ id: `bn-${month}`, label: "Performance Bonus", amount: bonus });
  const deductions = [];
  if (unpaid) deductions.push({ id: `up-${month}`, label: "Unpaid Leave", amount: unpaid });
  if (loan) deductions.push({ id: `ln-${month}`, label: "Salary Advance Recovery", amount: loan });
  const gross = [...earnings, ...incentives].reduce((s, e) => s + e.amount, 0);
  const ded = deductions.reduce((s, d) => s + d.amount, 0);
  return {
    payslip_id: 2600 + month,
    payslip_status: month === 9 ? "GENERATED" : "CREDITED",
    period: { label: MONTH_LABELS[month - 1], year: 2026, month },
    earnings,
    incentives,
    deductions,
    totals: { gross_salary: gross, total_deductions: ded, net_salary: gross - ded },
  };
};

const PAYSLIP_SPECS = {
  1: {}, 2: { overtime: 420 }, 3: { bonus: 1500 }, 4: { loan: 1000 }, 5: { unpaid: 600, loan: 1000 },
  6: { overtime: 315 }, 7: { loan: 1000 }, 8: {}, 9: { overtime: 525 },
};

export const MY_PAYSLIPS = (() => {
  const list = [];
  let ytd = { gross: 0, deductions: 0, net: 0, months: 0 };
  for (let m = 1; m <= 9; m++) {
    const p = buildPayslip(m, PAYSLIP_SPECS[m]);
    ytd = {
      gross: ytd.gross + p.totals.gross_salary,
      deductions: ytd.deductions + p.totals.total_deductions,
      net: ytd.net + p.totals.net_salary,
      months: ytd.months + 1,
    };
    list.push({ ...p, ytd: { ...ytd } });
  }
  return list.reverse();
})();

// ─── Staffing company portal (Gulf Manpower Services) ──────────────────────
// Workers this agency has supplied to the client's projects.
export const STAFFING_DASHBOARD = {
  total_employees: 48,
  active_projects: 3,
  completed_projects: 2,
  pending_actions: [
    { id: 1, type: "TIMESHEET" },
    { id: 2, type: "DOCUMENT" },
    { id: 3, type: "INVOICE" },
  ],
  distribution: { full_time: 30, contract: 18 },
  attendance_today: { expected: 44, present: 37, absent: 3, on_leave: 4 },
  top_projects: [
    { id: 1, name: PROJECTS[0].name, status: "ACTIVE", staff: 18, avatars: [{ name: "Imran Sheikh" }, { name: "Joseph Mathew" }, { name: "Bilal Ahmed" }] },
    { id: 2, name: PROJECTS[1].name, status: "ACTIVE", staff: 12, avatars: [{ name: "Ramesh Kumar" }, { name: "Arjun Nair" }] },
    { id: 3, name: PROJECTS[2].name, status: "ACTIVE", staff: 9, avatars: [{ name: "Tariq Mahmood" }, { name: "Nadeem Akhtar" }, { name: "Samuel Ofori" }] },
    { id: 5, name: "Jeddah Corniche Lighting", status: "COMPLETED", staff: 6, avatars: [{ name: "Mohammed Rafiq" }] },
  ],
};

export const STAFFING_PROFILE = {
  name: "Gulf Manpower Services",
  code: "STF-001",
  email: "ops@gulfmanpower.ae",
  phone: "97142345678",
  city: "Dubai",
  address: "Office 1204, Al Qusais Business Centre, Al Qusais, Dubai, UAE",
  contact_person_name: "Faisal Rahman",
  contact_person_email: "faisal.rahman@gulfmanpower.ae",
  contact_person_phone: "971501234567",
};

// Projects the agency supplies workers to (built on the shared PROJECTS).
export const STAFFING_PROJECTS = [
  ...PROJECTS.map((p, i) => ({
    id: p.id,
    project_name: p.name,
    project_code: p.code,
    project_location: p.location,
    photo_url: null,
    employee_count: [18, 12, 9, 4][i],
    contract_count: [8, 5, 4, 1][i],
    status: p.status === "ON_HOLD" ? "INACTIVE" : p.status,
    start_date: p.start_date,
    end_date: p.end_date,
    client_name: p.client_name,
  })),
  { id: 5, project_name: "Jeddah Corniche Lighting", project_code: "PRJ-005", project_location: "Jeddah Corniche", photo_url: null, employee_count: 6, contract_count: 6, status: "COMPLETED", start_date: "2025-02-01", end_date: "2025-12-15", client_name: "Jeddah Municipality" },
  { id: 6, project_name: "Sharjah Warehouse Fit-out", project_code: "PRJ-006", project_location: "Al Sajaa, Sharjah", photo_url: null, employee_count: 3, contract_count: 2, status: "COMPLETED", start_date: "2025-04-10", end_date: "2025-09-30", client_name: "Gulf Logistics" },
];

export const STAFFING_PROJECT_DASHBOARD = {
  total_projects: STAFFING_PROJECTS.length,
  active_projects: STAFFING_DASHBOARD.active_projects,
  completed_projects: STAFFING_DASHBOARD.completed_projects,
  total_employees: STAFFING_DASHBOARD.total_employees,
  distribution: STAFFING_DASHBOARD.distribution,
  attendance_today: STAFFING_DASHBOARD.attendance_today,
};

export const STAFFING_ROLES = [
  { id: 1, name: "Technician" },
  { id: 2, name: "Site Supervisor" },
  { id: 3, name: "Electrician" },
  { id: 4, name: "Helper" },
];

const role = (id) => STAFFING_ROLES.find((r) => r.id === id);
const proj = (id) => {
  const p = STAFFING_PROJECTS.find((x) => x.id === id);
  return { id: p.id, project_name: p.project_name };
};
const AGENCY = { id: 1, name: "Gulf Manpower Services" };
const worker = (id, full_name, iqama, roleId, projectId, employment_type, user_status = "ACTIVE") => ({
  id,
  country_emp_id: `GMS-${String(id).padStart(4, "0")}`,
  full_name,
  email: `${full_name.split(" ")[0].toLowerCase()}.${id}@gulfmanpower.ae`,
  profile_url: null,
  iqama,
  roles: [role(roleId)],
  employment_type,
  projects: [proj(projectId)],
  staffingCompany: AGENCY,
  user_status,
});

// Linked HRMS employees (9, 10, 12) plus agency-only workers.
export const STAFFING_WORKERS = [
  worker(9, EMPLOYEES[8].full_name, "2456781230", 1, 2, "CONTRACT"),
  worker(10, EMPLOYEES[9].full_name, "2456781231", 1, 1, "CONTRACT"),
  worker(12, EMPLOYEES[11].full_name, "2456781232", 2, 1, "FULL_TIME"),
  worker(101, "Ramesh Kumar", "2398110021", 3, 2, "FULL_TIME"),
  worker(102, "Arjun Nair", "2398110022", 4, 2, "CONTRACT"),
  worker(103, "Tariq Mahmood", "2398110023", 2, 3, "FULL_TIME"),
  worker(104, "Nadeem Akhtar", "2398110024", 3, 3, "FULL_TIME"),
  worker(105, "Samuel Ofori", "2398110025", 4, 3, "CONTRACT"),
  worker(106, "Mohammed Rafiq", "2398110026", 3, 5, "CONTRACT", "INACTIVE"),
  worker(107, "Jun dela Cruz", "2398110027", 1, 1, "FULL_TIME"),
  worker(108, "Abdul Basit", "2398110028", 4, 4, "FULL_TIME"),
  worker(109, "Ravi Shankar", "2398110029", 1, 6, "CONTRACT", "INACTIVE"),
];

// ─── Labour invoices (bills) ───────────────────────────────────────────────
const billItems = (billId, month) =>
  STAFFING_WORKERS.filter((w) => w.user_status === "ACTIVE").map((w, i) => {
    const worked = 208 - ((i + month) % 4) * 8;
    const ot = ((i * 3 + month) % 5) * 2;
    const rate = w.roles[0].id === 2 ? 28 : w.roles[0].id === 3 ? 22 : 16;
    const otAmount = ot * rate * 1.25;
    return {
      id: billId * 100 + i,
      employee: { id: w.id, name: w.full_name },
      project: { id: w.projects[0].id, name: w.projects[0].project_name },
      iqama: w.iqama,
      designation: w.roles[0].name,
      worked_hours: worked,
      overtime_hours: ot,
      overtime_amount: otAmount,
      net: worked * rate + otAmount,
    };
  });

const bill = (id, year, month, status, paid_at = null) => {
  const items = billItems(id, month);
  return {
    id,
    bill_no: `GMS-INV-${year}-${String(month).padStart(2, "0")}`,
    period: { year, month },
    employee_count: items.length,
    total_amount: items.reduce((s, it) => s + it.net, 0),
    currency: "SAR",
    status,
    paid_at,
    items,
  };
};

export const STAFFING_BILLS = [
  bill(14, 2026, 9, "APPROVED"),
  bill(13, 2026, 8, "PAID", "2026-09-10"),
  bill(12, 2026, 7, "PAID", "2026-08-09"),
  bill(11, 2026, 6, "PAID", "2026-07-08"),
  bill(10, 2026, 5, "PAID", "2026-06-10"),
  bill(9, 2026, 4, "PAID", "2026-05-11"),
  bill(8, 2026, 3, "PAID", "2026-04-09"),
  bill(7, 2026, 2, "PAID", "2026-03-10"),
  bill(6, 2026, 1, "PAID", "2026-02-09"),
  bill(5, 2025, 12, "PAID", "2026-01-12"),
  bill(4, 2025, 11, "PAID", "2025-12-10"),
  bill(3, 2025, 10, "PAID", "2025-11-10"),
];

export const STAFFING_ANNUAL_STATEMENTS = [
  { id: 2, label: "FY 2025", start_date: "2025-01-01", end_date: "2025-12-31", generated_at: "2026-01-15", pdf_download_url: "#", csv_download_url: "#" },
  { id: 1, label: "FY 2024", start_date: "2024-01-01", end_date: "2024-12-31", generated_at: "2025-01-14", pdf_download_url: "#", csv_download_url: null },
];
