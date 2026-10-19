// Static data for group E (payroll runs / preview / approvals, salary
// components, transactions, increments, salary history, leave encashments,
// staffing billing, loans). Nothing here talks to a backend.
//
// The lists are module-level arrays: screens read them, and the small helper
// functions below mutate them for create / edit / approve / delete actions, so
// a change made on one screen shows up on the others for the rest of the
// session (a reload starts over).

import { DEPARTMENTS, EMPLOYEES, PROJECTS, employeeById, matches, nextId, paginate } from "./common";

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pad = (n) => String(n).padStart(2, "0");
const todayIso = () => new Date().toISOString();

// The employee behind "my" screens (My Loans, My salary history) — matches the
// static EMPLOYEE session user (Sara Khan).
export const MY_EMPLOYEE_ID = 4;

// ── Projects (payroll screens read `project_name`) ──────────────────────────
export const PAYROLL_PROJECTS = PROJECTS.map((p) => ({ ...p, project_name: p.name }));

// Which project each employee is posted to (drives project-scoped runs + the salary report).
const EMP_PROJECT = { 1: 4, 2: 4, 3: 1, 4: 4, 5: 4, 6: 1, 7: 3, 8: 2, 9: 2, 10: 1, 11: 3, 12: 3 };
const projectOf = (empId) => PAYROLL_PROJECTS.find((p) => p.id === EMP_PROJECT[empId]) || null;

// Iqama / Emirates-ID style document numbers for the reports.
const idNumberOf = (e) =>
  e.office_id === 3 ? `2${String(431000000 + e.id * 7919).slice(0, 9)}` : `784-19${80 + (e.id % 15)}-${String(4410000 + e.id * 1301).slice(0, 7)}-${e.id % 9}`;

export const ACTIVE_EMPLOYEES = EMPLOYEES.filter((e) => e.status === "ACTIVE");

// ── Salary components ───────────────────────────────────────────────────────
export const SALARY_COMPONENTS = [
  { id: 1, name: "Basic", type: "EARNING", is_active: true, is_system: true, description: "Base monthly salary as per the employment contract." },
  { id: 2, name: "Hourly", type: "EARNING", is_active: true, is_system: true, description: "Hourly rate for hourly-paid staff (system component)." },
  { id: 3, name: "Overtime", type: "EARNING", is_active: true, is_system: true, description: "Approved overtime hours, paid at 1.25x the hourly rate." },
  { id: 4, name: "Housing Allowance", type: "EARNING", is_active: true, is_system: false, description: "25% of basic, paid monthly." },
  { id: 5, name: "Transport Allowance", type: "EARNING", is_active: true, is_system: false, description: "10% of basic, paid monthly." },
  { id: 6, name: "Other Allowance", type: "EARNING", is_active: true, is_system: false, description: "Phone, food and other fixed allowances." },
  { id: 7, name: "Performance Bonus", type: "EARNING", is_active: true, is_system: false, description: "Quarterly performance bonus." },
  { id: 8, name: "Site Allowance", type: "EARNING", is_active: false, is_system: false, description: "Remote site allowance (paused)." },
  { id: 9, name: "GOSI", type: "DEDUCTION", is_active: true, is_system: true, description: "Saudi social insurance — 9.75% of basic + housing." },
  { id: 10, name: "Loan EMI", type: "DEDUCTION", is_active: true, is_system: true, description: "Monthly installment of an active company loan." },
  { id: 11, name: "Absence Deduction", type: "DEDUCTION", is_active: true, is_system: false, description: "Unpaid absence, pro-rata of gross." },
  { id: 12, name: "Salary Advance Recovery", type: "DEDUCTION", is_active: true, is_system: false, description: "Recovery of a salary advance." },
  { id: 13, name: "Traffic Fine", type: "DEDUCTION", is_active: false, is_system: false, description: "Company-vehicle traffic fines." },
];

export const createSalaryComponent = (data) => {
  const row = { id: nextId(SALARY_COMPONENTS), name: data.name, type: data.type, is_active: true, is_system: false, description: data.description || "" };
  SALARY_COMPONENTS.push(row);
  return row;
};
export const updateSalaryComponent = (id, data) => {
  const row = SALARY_COMPONENTS.find((c) => c.id === Number(id));
  if (row) Object.assign(row, data);
  return row;
};
// "Delete" deactivates (the API's soft delete).
export const deactivateSalaryComponent = (id) => updateSalaryComponent(id, { is_active: false });

// ── Salary transactions (ad-hoc month lines) ────────────────────────────────
const tx = (id, empId, period_month, label, amount, type = "EARNING", extra = {}) => {
  const e = employeeById(empId);
  const p = extra.project_id ? PAYROLL_PROJECTS.find((x) => x.id === extra.project_id) : null;
  return {
    id,
    employee_id: e.id,
    employee_name: e.full_name,
    employee_code: e.employee_code,
    project_id: p?.id ?? null,
    project_name: p?.project_name ?? null,
    period_year: 2026,
    period_month,
    type,
    is_advance: false,
    salary_component_id: null,
    label,
    amount,
    ...extra,
  };
};

export const TRANSACTIONS = [
  tx(1, 3, 10, "Performance Bonus Q3", 2500, "EARNING", { salary_component_id: 7 }),
  tx(2, 7, 10, "Site Allowance — Riyadh Metro", 1200, "EARNING", { project_id: 3 }),
  tx(3, 9, 10, "Salary Advance", 1500, "DEDUCTION", { is_advance: true }),
  tx(4, 12, 10, "Traffic Fine — Sheikh Zayed Rd", 600, "DEDUCTION", { salary_component_id: 13 }),
  tx(5, 6, 10, "Referral Bonus", 1000),
  tx(6, 10, 10, "Damaged Tools Recovery", 250, "DEDUCTION", { project_id: 1 }),
  tx(7, 8, 10, "Sales Commission — September", 3200),
  tx(8, 5, 10, "Mobile Bill Excess", 180, "DEDUCTION"),
  tx(9, 4, 10, "Eid Bonus", 1500),
  tx(10, 2, 10, "Relocation Allowance", 5000),
  tx(11, 1, 10, "Training Reimbursement", 2200),
  tx(12, 3, 9, "On-call Allowance", 800),
  tx(13, 9, 9, "Salary Advance", 1000, "DEDUCTION", { is_advance: true }),
  tx(14, 7, 9, "Absence (2 days)", 933.33, "DEDUCTION", { salary_component_id: 11 }),
  tx(15, 8, 8, "Sales Commission — July", 2750),
];

export const addTransaction = (data) => {
  const e = employeeById(data.employee_id);
  const p = data.project_id ? PAYROLL_PROJECTS.find((x) => x.id === Number(data.project_id)) : null;
  const row = {
    ...data,
    id: nextId(TRANSACTIONS),
    employee_name: e.full_name,
    employee_code: e.employee_code,
    project_name: p?.project_name ?? null,
  };
  TRANSACTIONS.unshift(row);
  return row;
};
export const removeTransaction = (id) => {
  const i = TRANSACTIONS.findIndex((r) => r.id === Number(id));
  if (i >= 0) TRANSACTIONS.splice(i, 1);
};

// ── Payroll runs + payslips ─────────────────────────────────────────────────
let lineSeq = 1000;
const line = (label, amount, is_auto = true) => ({ id: ++lineSeq, label, amount: r2(amount), is_auto });

// Month-specific extras so the payslips are not all alike.
const OT_HOURS = { 3: 6, 7: 14, 9: 22, 10: 18, 12: 9 };
const LOAN_EMI = { 4: 1250, 9: 500, 12: 800 };
const ABSENT = { 10: 1, 6: 2 };

const recalcPayslip = (p) => {
  const earn = p.earnings.reduce((s, l) => s + l.amount, 0);
  const inc = p.incentives.reduce((s, l) => s + l.amount, 0);
  const ded = p.deductions.reduce((s, l) => s + l.amount, 0);
  p.gross_salary = r2(earn + inc);
  p.allowances = r2(p.gross_salary - p.basic_salary);
  p.total_deductions = r2(ded);
  p.net_salary = r2(p.gross_salary - p.total_deductions);
  return p;
};

const fyMonthIndex = (month) => month; // FY = calendar year (startMonth 1)

const buildPayslip = (runId, e, year, month, status) => {
  const basic = e.basic_salary;
  const housing = r2(basic * 0.25);
  const transport = r2(basic * 0.1);
  const other = r2(Math.max(0, e.gross_salary - basic - housing - transport));
  const earnings = [line("Basic", basic), line("Housing Allowance", housing), line("Transport Allowance", transport)];
  if (other > 0) earnings.push(line("Other Allowance", other));

  const hourly = r2(basic / 30 / 8);
  const otHours = (OT_HOURS[e.id] || 0) + ((month + e.id) % 3);
  const incentives = [];
  if (otHours > 0) incentives.push(line("Overtime", otHours * hourly * 1.25));
  TRANSACTIONS.filter((t) => t.employee_id === e.id && t.period_year === year && t.period_month === month && t.type === "EARNING").forEach((t) =>
    incentives.push(line(t.label, t.amount, false)),
  );

  const deductions = [];
  if (e.nationality === "Saudi Arabia") deductions.push(line("GOSI", (basic + housing) * 0.0975));
  if (LOAN_EMI[e.id]) deductions.push(line("Loan EMI", LOAN_EMI[e.id]));
  const absent = ABSENT[e.id] && month % 2 === 0 ? ABSENT[e.id] : 0;
  if (absent) deductions.push(line("Absence Deduction", (e.gross_salary / 30) * absent));
  TRANSACTIONS.filter((t) => t.employee_id === e.id && t.period_year === year && t.period_month === month && t.type === "DEDUCTION").forEach((t) =>
    deductions.push(line(t.label, t.amount, false)),
  );

  const working = 22;
  const leave = (e.id + month) % 4 === 0 ? 2 : (e.id + month) % 5 === 0 ? 1 : 0;
  const p = {
    payslip_id: runId * 100 + e.id,
    run_id: runId,
    employee_id: e.id,
    employee: {
      id: e.id,
      name: e.full_name,
      code: e.employee_code,
      department: e.department_name,
      designation: e.designation_name,
      profile_url: null,
    },
    period: { month, year },
    basic_salary: basic,
    status,
    attendance: { working_days: working, present_days: working - leave - absent, leave_days: leave, overtime_hours: otHours },
    earnings,
    incentives,
    deductions,
  };
  recalcPayslip(p);
  const m = fyMonthIndex(month);
  p.ytd = { gross: r2(p.gross_salary * m), deductions: r2(p.total_deductions * m), net: r2(p.net_salary * m), months: m };
  return p;
};

const PAYSLIP_STATUS_OF = { PAID: "CREDITED", CREDITED: "CREDITED" };

const recalcRun = (run) => {
  run.employee_count = run.payslips.length;
  run.gross_total = r2(run.payslips.reduce((s, p) => s + p.gross_salary, 0));
  run.deductions_total = r2(run.payslips.reduce((s, p) => s + p.total_deductions, 0));
  run.total_net = r2(run.payslips.reduce((s, p) => s + p.net_salary, 0));
  return run;
};

const employeesForRun = (projectId, employmentType) =>
  ACTIVE_EMPLOYEES.filter(
    (e) => (!projectId || EMP_PROJECT[e.id] === Number(projectId)) && (!employmentType || e.employment_type === employmentType),
  );

const makeRun = (id, year, month, status, { project_id = null, can_act = false, employment_type = null, created_at } = {}) => {
  const slipStatus = PAYSLIP_STATUS_OF[status] || "PENDING";
  const payslips = employeesForRun(project_id, employment_type).map((e) => buildPayslip(id, e, year, month, slipStatus));
  if (status === "DRAFT" && payslips[1]) payslips[1].status = "HOLD";
  return recalcRun({
    id,
    period_month: month,
    period_year: year,
    year,
    month: new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" }),
    project_id,
    status,
    can_act,
    created_at: created_at || `${year}-${pad(month)}-26T09:00:00Z`,
    payslips,
  });
};

export const PAYROLL_RUNS = [
  makeRun(1, 2026, 10, "DRAFT"),
  makeRun(2, 2026, 9, "PENDING_APPROVAL", { can_act: true }),
  makeRun(3, 2026, 9, "REJECTED", { project_id: 3 }),
  makeRun(4, 2026, 8, "APPROVED"),
  makeRun(5, 2026, 7, "CREDITED"),
  makeRun(6, 2026, 6, "PAID"),
  makeRun(7, 2026, 5, "PAID"),
  makeRun(8, 2026, 4, "CREDITED", { project_id: 1 }),
  makeRun(9, 2026, 3, "PAID"),
];

export const findRun = (id) => PAYROLL_RUNS.find((r) => r.id === Number(id)) || null;
const findPayslip = (payslipId) => {
  for (const r of PAYROLL_RUNS) {
    const p = r.payslips.find((x) => x.payslip_id === Number(payslipId));
    if (p) return { run: r, payslip: p };
  }
  return { run: null, payslip: null };
};

// List row = the run without its payslips (what the list endpoint returns).
const omit = (obj, key) => {
  const out = { ...obj };
  delete out[key];
  return out;
};
const runRow = (run) => omit(run, "payslips");

export const listPayrollRuns = ({ period_year, period_month, project_id, status } = {}) =>
  PAYROLL_RUNS.filter(
    (r) =>
      (!period_year || r.period_year === Number(period_year)) &&
      (!period_month || r.period_month === Number(period_month)) &&
      (!project_id || r.project_id === Number(project_id)) &&
      (!status || r.status === status),
  )
    .slice()
    .sort((a, b) => b.period_year - a.period_year || b.period_month - a.period_month || b.id - a.id)
    .map(runRow);

// { run, payslips: { data, total, total_pages } } — the run detail endpoint shape.
export const getPayrollRunDetail = (id, page = 1, limit = 10) => {
  const run = findRun(id);
  if (!run) return null;
  const pg = paginate(run.payslips, page, limit);
  return { run: runRow(run), payslips: { data: pg.rows, total: pg.total, total_pages: pg.totalPages, page, limit } };
};

// Create + generate in one go → { id, employee_count, skipped_count }.
export const createPayrollRun = ({ period_month, period_year, project_id = null, employment_type = null }) => {
  const id = nextId(PAYROLL_RUNS);
  const run = makeRun(id, Number(period_year), Number(period_month), "DRAFT", {
    project_id: project_id ? Number(project_id) : null,
    employment_type,
    created_at: todayIso(),
  });
  PAYROLL_RUNS.unshift(run);
  const skipped = employeesForRun(project_id, null).length - run.payslips.length;
  return { id, employee_count: run.employee_count, skipped_count: Math.max(0, employment_type ? 0 : skipped) };
};

export const setPayrollRunStatus = (id, status) => {
  const run = findRun(id);
  if (!run) return null;
  run.status = status;
  run.can_act = status === "PENDING_APPROVAL";
  if (status === "CREDITED" || status === "PAID") run.payslips.forEach((p) => (p.status = "CREDITED"));
  return run;
};

export const deletePayrollRun = (id) => {
  const i = PAYROLL_RUNS.findIndex((r) => r.id === Number(id));
  if (i >= 0) PAYROLL_RUNS.splice(i, 1);
};

export const addPayslipLine = (payslipId, { type, label, amount }) => {
  const { run, payslip } = findPayslip(payslipId);
  if (!payslip) return;
  (type === "DEDUCTION" ? payslip.deductions : payslip.incentives).push(line(label, Number(amount), false));
  recalcPayslip(payslip);
  recalcRun(run);
};

export const removePayslipLine = (payslipId, itemId) => {
  const { run, payslip } = findPayslip(payslipId);
  if (!payslip) return;
  payslip.incentives = payslip.incentives.filter((l) => l.id !== Number(itemId));
  payslip.deductions = payslip.deductions.filter((l) => l.id !== Number(itemId));
  recalcPayslip(payslip);
  recalcRun(run);
};

// One payslip in the GET /payroll/:id shape (EmployeePayrollReview).
export const getPayslipDetail = (payslipId) => {
  const { payslip: p } = findPayslip(payslipId);
  if (!p) return null;
  return {
    payslip_id: p.payslip_id,
    employee: p.employee,
    period: p.period,
    payslip_status: p.status,
    earnings: p.earnings,
    incentives: p.incentives,
    deductions: p.deductions,
    totals: { gross_salary: p.gross_salary, total_deductions: p.total_deductions, net_salary: p.net_salary },
    attendance: {
      total_working_days: p.attendance.working_days,
      total_present_days: p.attendance.present_days,
      leave_days: p.attendance.leave_days,
    },
    overtime: { overtime_hours: p.attendance.overtime_hours },
    ytd: p.ytd,
  };
};

// ── Salary report (one month, grouped by project) ───────────────────────────
const sumRows = (rows) => {
  const keys = ["work_hours", "allotted_hours", "basic_pay", "allowances", "ot_hours", "ot_pay", "gross", "advance", "deductions", "net"];
  return Object.fromEntries(keys.map((k) => [k, r2(rows.reduce((s, r) => s + Number(r[k] || 0), 0))]));
};

export const getSalaryReport = (month, projectId) => {
  const [y, m] = String(month || "").split("-").map(Number);
  const run = PAYROLL_RUNS.find((r) => r.period_year === y && r.period_month === m && !r.project_id && r.status !== "REJECTED");
  if (!run) return { month, generated: false, projects: [], grand_total: null, employee_count: 0 };
  const groups = new Map();
  run.payslips.forEach((p) => {
    const e = employeeById(p.employee_id);
    const proj = projectOf(e.id);
    if (projectId && String(proj?.id) !== String(projectId)) return;
    const hourlyPaid = e.employment_type === "CONTRACT";
    const otLine = p.incentives.find((l) => l.label === "Overtime");
    const advance = TRANSACTIONS.filter((t) => t.employee_id === e.id && t.is_advance && t.period_year === y && t.period_month === m).reduce((s, t) => s + t.amount, 0);
    const allotted = 208;
    const row = {
      employee_id: e.id,
      name: e.full_name,
      id_number: idNumberOf(e),
      designation: e.designation_name,
      work_hours: r2(p.attendance.present_days * 8 + (hourlyPaid ? 12 : 0)),
      allotted_hours: allotted,
      per_hour_rate: hourlyPaid ? r2(e.basic_salary / allotted) : null,
      basic_pay: p.basic_salary,
      allowances: r2(p.allowances - (otLine?.amount || 0)),
      ot_hours: p.attendance.overtime_hours,
      ot_pay: otLine?.amount || 0,
      gross: p.gross_salary,
      advance: r2(advance),
      deductions: p.total_deductions,
      net: p.net_salary,
    };
    const key = proj?.id ?? null;
    if (!groups.has(key)) groups.set(key, { project_id: key, project_name: proj?.project_name || "Unassigned", rows: [] });
    groups.get(key).rows.push(row);
  });
  const projects = [...groups.values()].map((g) => ({ ...g, subtotal: sumRows(g.rows) }));
  const all = projects.flatMap((g) => g.rows);
  return { month, generated: true, projects, grand_total: sumRows(all), employee_count: all.length };
};

// ── Staffing companies + bills ──────────────────────────────────────────────
export const STAFFING_COMPANIES = [
  { id: 1, name: "Gulf Manpower Services" },
  { id: 2, name: "Al Khaleej Labour Supply" },
  { id: 3, name: "Desert Star Contracting" },
  { id: 4, name: "Emirates Skilled Workforce" },
];

const WORKERS = {
  1: [["Ramesh Kumar", "Mason"], ["Abdul Rahim", "Steel Fixer"], ["Suresh Nair", "Electrician"], ["Mohammed Iqbal", "Plumber"], ["Arjun Thapa", "Helper"], ["Nasir Uddin", "Carpenter"], ["Rizwan Ali", "Scaffolder"]],
  2: [["Jomon Varghese", "Welder"], ["Tariq Mahmood", "Driver"], ["Bikram Gurung", "Helper"], ["Faisal Khan", "Foreman"], ["Anil Yadav", "Painter"]],
  3: [["Hassan Mubarak", "Operator"], ["Raju Shrestha", "Helper"], ["Kamal Hossain", "Mason"], ["Imtiaz Ahmed", "Surveyor"], ["Vinod Pillai", "Electrician"], ["Saeed Anwar", "Rigger"]],
  4: [["Ali Raza", "HVAC Technician"], ["Prakash Rai", "Helper"], ["Sajid Hussain", "Plumber"], ["Deepak Bhatt", "Carpenter"]],
};

const billItems = (billId, companyId, month) =>
  (WORKERS[companyId] || []).map(([name, designation], i) => {
    const worked = 200 + ((i * 7 + month) % 40);
    const rate = 14 + (i % 4) * 2;
    const gross = r2(worked * rate);
    const ot = (i * 3 + month) % 18;
    const otAmount = r2(ot * rate * 1.25);
    const proj = PAYROLL_PROJECTS[(companyId + i) % 3];
    return {
      id: billId * 100 + i + 1,
      employee: { id: companyId * 100 + i + 1, name },
      project: { id: proj.id, name: proj.project_name },
      iqama: `2${String(450000000 + companyId * 10007 + i * 1777)}`,
      designation,
      worked_hours: worked,
      gross,
      overtime_hours: ot,
      overtime_amount: otAmount,
      net: r2(gross + otAmount),
    };
  });

const makeBill = (id, companyId, year, month, status, extra = {}) => {
  const items = billItems(id, companyId, month);
  return {
    id,
    bill_no: `SB-${year}${pad(month)}-${pad(companyId)}${pad(id)}`,
    staffing_company: STAFFING_COMPANIES.find((c) => c.id === companyId),
    period: { month, year },
    currency: "SAR",
    status,
    sent_to_portal: false,
    paid_at: null,
    created_at: `${year}-${pad(month)}-28T10:00:00Z`,
    items,
    employee_count: items.length,
    total_amount: r2(items.reduce((s, it) => s + it.net, 0)),
    ...extra,
  };
};

export const STAFFING_BILLS = [
  makeBill(1, 1, 2026, 9, "DRAFT"),
  makeBill(2, 2, 2026, 9, "PENDING_APPROVAL"),
  makeBill(3, 3, 2026, 9, "APPROVED"),
  makeBill(4, 1, 2026, 8, "PAID", { sent_to_portal: true, paid_at: "2026-09-12T08:30:00Z" }),
  makeBill(5, 2, 2026, 8, "APPROVED", { sent_to_portal: true }),
  makeBill(6, 4, 2026, 8, "REJECTED"),
  makeBill(7, 3, 2026, 7, "PAID", { sent_to_portal: true, paid_at: "2026-08-14T08:30:00Z" }),
];

const billView = (b) => ({
  ...b,
  can_act: b.status === "PENDING_APPROVAL",
  can_send: b.status === "APPROVED" && !b.sent_to_portal,
});

export const listStaffingBills = ({ staffing_company_id, status } = {}) =>
  STAFFING_BILLS.filter(
    (b) => (!staffing_company_id || b.staffing_company.id === Number(staffing_company_id)) && (!status || b.status === status),
  )
    .slice()
    .sort((a, b) => b.period.year - a.period.year || b.period.month - a.period.month || b.id - a.id)
    .map((b) => billView(omit(b, "items")));

export const getStaffingBill = (id, page = 1, limit = 25) => {
  const b = STAFFING_BILLS.find((x) => x.id === Number(id));
  if (!b) return null;
  const pg = paginate(b.items, page, limit);
  return { ...billView(b), items: pg.rows, items_pagination: { page, limit, total: pg.total, total_pages: pg.totalPages } };
};

const billFor = (companyId, year, month) =>
  STAFFING_BILLS.find((b) => b.staffing_company.id === Number(companyId) && b.period.year === year && b.period.month === month && b.status !== "REJECTED");

export const generateStaffingBill = (companyId, year, month) => {
  const existing = billFor(companyId, year, month);
  if (existing) return existing;
  const bill = makeBill(nextId(STAFFING_BILLS), Number(companyId), year, month, "DRAFT", { created_at: todayIso() });
  STAFFING_BILLS.unshift(bill);
  return bill;
};

export const generateAllStaffingBills = (year, month) => {
  let generated = 0;
  let skipped = 0;
  STAFFING_COMPANIES.forEach((c) => {
    if (billFor(c.id, year, month)) skipped += 1;
    else {
      generateStaffingBill(c.id, year, month);
      generated += 1;
    }
  });
  return { generated, skipped };
};

export const updateStaffingBill = (id, patch) => {
  const b = STAFFING_BILLS.find((x) => x.id === Number(id));
  if (b) Object.assign(b, patch);
  return b;
};

// ── Salary history (per employee) + single increments ───────────────────────
const ADMIN_NAME = "Ahmed Al Mansoori";
let historySeq = 5000;

const historyFor = (e) => {
  const cur = { basic: e.basic_salary, gross: e.gross_salary };
  const prev = { basic: r2(cur.basic / 1.05), gross: r2(cur.gross - (cur.basic - cur.basic / 1.05)) };
  const first = { basic: r2(prev.basic / 1.04), gross: r2(prev.gross - (prev.basic - prev.basic / 1.04)) };
  const joined = e.date_of_joining;
  const rows = [
    { salary_id: e.id * 10 + 1, effective_from: joined, ...first, increment: null },
    {
      salary_id: e.id * 10 + 2,
      effective_from: "2025-04-01",
      ...prev,
      increment: { id: 900 + e.id * 2, kind: "BULK", type: "PERCENT", value: 4, title: "Annual Increment 2025", reason: "Annual Increment 2025", effective_date: "2025-04-01", created_by: { name: ADMIN_NAME } },
    },
    {
      salary_id: e.id * 10 + 3,
      effective_from: "2026-04-01",
      ...cur,
      increment: { id: 901 + e.id * 2, kind: "BULK", type: "PERCENT", value: 5, title: "Annual Increment 2026", reason: "Annual Increment 2026", effective_date: "2026-04-01", created_by: { name: ADMIN_NAME } },
    },
  ].filter((r) => r.effective_from >= joined);
  return rows;
};

const SALARY_HISTORY = new Map();
const historyRows = (employeeId) => {
  const id = Number(employeeId);
  if (!SALARY_HISTORY.has(id)) SALARY_HISTORY.set(id, historyFor(employeeById(id)));
  return SALARY_HISTORY.get(id);
};

// Newest first, with change vs the previous row + the current / scheduled flags.
export const getSalaryHistory = (employeeId, { self = false } = {}) => {
  const today = new Date().toISOString().slice(0, 10);
  const asc = historyRows(employeeId).slice().sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const currentIdx = asc.reduce((acc, r, i) => (r.effective_from <= today ? i : acc), 0);
  const out = asc.map((r, i) => {
    const prev = asc[i - 1];
    const change = prev
      ? {
          old_basic: prev.basic,
          old_gross: prev.gross,
          gross_diff: r2(r.gross - prev.gross),
          gross_percent: prev.gross ? r2(((r.gross - prev.gross) / prev.gross) * 100) : null,
        }
      : null;
    return {
      ...r,
      currency: "AED",
      change,
      is_current: i === currentIdx,
      scheduled: r.effective_from > today,
      can_revert: !self && !!r.increment && i === asc.length - 1,
    };
  });
  return out.reverse();
};

// One employee's increment → a new salary row from the 1st of the effective month.
export const addEmployeeIncrement = (employeeId, data) => {
  const rows = historyRows(employeeId);
  const last = rows.slice().sort((a, b) => a.effective_from.localeCompare(b.effective_from)).slice(-1)[0];
  const v = Number(data.value);
  let basic = last.basic;
  let gross = last.gross;
  if (data.type === "AMOUNT") {
    basic = r2(basic + v);
    gross = r2(gross + v);
  } else if (data.applies_to === "ALL_FIXED") {
    basic = r2(basic * (1 + v / 100));
    gross = r2(gross * (1 + v / 100));
  } else {
    const add = r2(basic * (v / 100));
    basic = r2(basic + add);
    gross = r2(gross + add);
  }
  const effective_from = `${String(data.effective_date).slice(0, 7)}-01`;
  const increment = {
    id: ++historySeq,
    kind: "SINGLE",
    type: data.type,
    value: v,
    applies_to: data.applies_to,
    title: data.reason,
    reason: data.reason,
    effective_date: data.effective_date,
    created_by: { name: ADMIN_NAME },
  };
  rows.push({ salary_id: ++historySeq, effective_from, basic, gross, increment });
  return { ...increment, old_basic: last.basic, new_basic: basic, old_gross: last.gross, new_gross: gross, effective_from };
};

export const revertSalaryIncrement = (incrementId) => {
  for (const rows of SALARY_HISTORY.values()) {
    const i = rows.findIndex((r) => r.increment?.id === Number(incrementId));
    if (i >= 0) {
      rows.splice(i, 1);
      return true;
    }
  }
  return false;
};

// ── Increment batches ───────────────────────────────────────────────────────
const batchEmployees = (filters) => {
  const f = filters || {};
  return ACTIVE_EMPLOYEES.filter(
    (e) =>
      (!f.department_ids?.length || f.department_ids.includes(e.department_id)) &&
      (!f.designation_ids?.length || f.designation_ids.includes(e.designation_id)) &&
      (!f.project_ids?.length || f.project_ids.includes(EMP_PROJECT[e.id])) &&
      (!f.employee_ids?.length || f.employee_ids.includes(e.id)),
  );
};

const newGrossOf = (e, b) => {
  const v = Number(b.value);
  if (b.type === "AMOUNT") return r2(e.gross_salary + v);
  if (b.applies_to === "ALL_FIXED") return r2(e.gross_salary * (1 + v / 100));
  return r2(e.gross_salary + e.basic_salary * (v / 100));
};

const buildLines = (b) =>
  batchEmployees(b.filters).map((e, i) => {
    const prev = (b.lines || []).find((l) => l.employee_id === e.id);
    const newGross = newGrossOf(e, b);
    return {
      id: b.id * 100 + i + 1,
      employee_id: e.id,
      employee_name: e.full_name,
      employee_code: e.employee_code,
      old_gross: e.gross_salary,
      new_gross: newGross,
      difference: r2(newGross - e.gross_salary),
      excluded: prev ? prev.excluded : false,
    };
  });

const recalcBatch = (b) => {
  const lines = b.lines || [];
  const inc = lines.filter((l) => !l.excluded);
  b.line_count = lines.length;
  b.excluded_count = lines.length - inc.length;
  b.totals = {
    employees: lines.length,
    included: inc.length,
    old_gross: r2(inc.reduce((s, l) => s + l.old_gross, 0)),
    new_gross: r2(inc.reduce((s, l) => s + l.new_gross, 0)),
  };
  return b;
};

const makeBatch = (id, data, { preview = true, excluded = [], ...extra } = {}) => {
  const b = {
    id,
    kind: "BULK",
    applies_to: "BASIC_ONLY",
    filters: null,
    status: "DRAFT",
    applied_at: null,
    reverted_at: null,
    effective_date: null,
    reason: null,
    skipped_no_salary: [],
    lines: [],
    ...data,
    ...extra,
  };
  if (preview) b.lines = buildLines(b).map((l) => ({ ...l, excluded: excluded.includes(l.employee_id) }));
  return recalcBatch(b);
};

export const INCREMENT_BATCHES = [
  makeBatch(1, { title: "Annual Increment 2026", type: "PERCENT", value: 5, applies_to: "BASIC_ONLY", effective_month: 4, effective_year: 2026 }, { status: "APPLIED", applied_at: "2026-03-28T11:00:00Z", excluded: [9, 10] }),
  makeBatch(2, { title: "Engineering Market Adjustment", type: "PERCENT", value: 8, applies_to: "ALL_FIXED", effective_month: 11, effective_year: 2026, filters: { department_ids: [1] } }),
  makeBatch(3, { title: "Site Staff Flat Raise", type: "AMOUNT", value: 500, effective_month: 12, effective_year: 2026, filters: { department_ids: [4] } }, { preview: false }),
  makeBatch(4, { title: "Finance Retention Raise", type: "PERCENT", value: 3, effective_month: 7, effective_year: 2026, filters: { department_ids: [3] } }, { status: "REVERTED", applied_at: "2026-06-25T10:00:00Z", reverted_at: "2026-07-02T09:15:00Z" }),
  makeBatch(5, { title: "Promotion — Team Lead", kind: "SINGLE", type: "AMOUNT", value: 1500, effective_month: 6, effective_year: 2026, filters: { employee_ids: [3] } }, { status: "APPLIED", applied_at: "2026-06-01T08:00:00Z", effective_date: "2026-06-01", reason: "Promoted to Team Lead, Platform squad" }),
  makeBatch(6, { title: "Sales Q4 Incentive Raise", type: "PERCENT", value: 4, effective_month: 10, effective_year: 2026, filters: { department_ids: [5], designation_ids: [8] } }),
];

const findBatch = (id) => INCREMENT_BATCHES.find((b) => b.id === Number(id)) || null;
const batchCopy = (b) => (b ? { ...b, lines: b.lines.map((l) => ({ ...l })), totals: { ...b.totals } } : null);

export const listIncrementBatches = ({ fy, status, kind, search } = {}) =>
  INCREMENT_BATCHES.filter(
    (b) => (!fy || b.effective_year === Number(fy)) && (!status || b.status === status) && (!kind || b.kind === kind) && matches(b, search, ["title", "reason"]),
  )
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((b) => omit(b, "lines"));

export const getIncrementBatch = (id) => batchCopy(findBatch(id));

export const saveIncrementBatch = (id, payload) => {
  const existing = id ? findBatch(id) : null;
  if (existing) {
    Object.assign(existing, payload, { lines: [] });
    recalcBatch(existing);
    return batchCopy(existing);
  }
  const b = makeBatch(nextId(INCREMENT_BATCHES), payload, { preview: false });
  INCREMENT_BATCHES.unshift(b);
  return batchCopy(b);
};

export const previewIncrementBatch = (id) => {
  const b = findBatch(id);
  if (!b) return null;
  b.lines = buildLines(b);
  recalcBatch(b);
  return batchCopy(b);
};

export const toggleIncrementLine = (id, lineId, excluded) => {
  const b = findBatch(id);
  const l = b?.lines.find((x) => x.id === Number(lineId));
  if (l) l.excluded = !!excluded;
  if (b) recalcBatch(b);
  return batchCopy(b);
};

export const applyIncrementBatch = (id) => {
  const b = findBatch(id);
  if (!b) return null;
  b.status = "APPLIED";
  b.applied_at = todayIso();
  return { ...batchCopy(b), applied_count: b.totals.included };
};

export const revertIncrementBatch = (id) => {
  const b = findBatch(id);
  if (!b) return null;
  b.status = "REVERTED";
  b.reverted_at = todayIso();
  return { ...batchCopy(b), reverted_count: b.totals.included };
};

export const deleteIncrementBatch = (id) => {
  const i = INCREMENT_BATCHES.findIndex((b) => b.id === Number(id));
  if (i >= 0) INCREMENT_BATCHES.splice(i, 1);
};

// ── Loans ───────────────────────────────────────────────────────────────────
const addMonths = (y, m, n) => {
  const d = new Date(y, m - 1 + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

// EMI schedule: amount / n, the last EMI absorbs the remainder (mirrors loanUi.previewEmi).
const schedule = (loanId, amount, n, startY, startM, { paid = 0, skipped = [] } = {}) => {
  const emi = r2(amount / n);
  let balance = amount;
  const rows = [];
  for (let i = 1; i <= n; i += 1) {
    const isSkipped = skipped.includes(i);
    const { year, month } = addMonths(startY, startM, i - 1);
    const amt = i === n ? r2(amount - emi * (n - 1)) : emi;
    const status = isSkipped ? "SKIPPED" : i - skipped.filter((s) => s < i).length <= paid ? "PAID" : "PENDING";
    if (!isSkipped) balance = r2(balance - amt);
    rows.push({
      id: loanId * 100 + i,
      installment_no: i,
      period_year: year,
      period_month: month,
      due_date: `${year}-${pad(month)}-28`,
      emi_amount: amt,
      closing_balance: Math.max(0, balance),
      status,
    });
  }
  return rows;
};

const paymentsOf = (loanId, installments) =>
  installments
    .filter((i) => i.status === "PAID")
    .map((i) => ({
      id: loanId * 1000 + i.installment_no,
      method: "SALARY_DEDUCTION",
      period_year: i.period_year,
      period_month: i.period_month,
      paid_at: `${i.period_year}-${pad(i.period_month)}-28T12:00:00Z`,
      amount: i.emi_amount,
      status: "SUCCESS",
    }));

const loanEmployee = (id) => {
  const e = employeeById(id);
  return { id: e.id, full_name: e.full_name, country_emp_id: e.employee_code };
};

const makeLoan = (id, employeeId, data) => {
  const {
    amount,
    installments: n,
    status,
    start = [2026, 1],
    paid = 0,
    skipped = [],
    meta = {},
    ...rest
  } = data;
  const approved = ["APPROVED", "DISBURSED", "ACTIVE", "COMPLETED", "CLOSED", "FORECLOSED"].includes(status);
  const inst = approved ? schedule(id, amount, n, start[0], start[1], { paid, skipped }) : [];
  if (status === "COMPLETED" || status === "CLOSED") inst.forEach((i) => i.status !== "SKIPPED" && (i.status = "PAID"));
  const paidSum = inst.filter((i) => i.status === "PAID").reduce((s, i) => s + i.emi_amount, 0);
  return {
    id,
    loan_number: `LN-2026-${String(id).padStart(4, "0")}`,
    employee_id: employeeId,
    employee: loanEmployee(employeeId),
    requested_amount: amount,
    requested_installments: n,
    approved_amount: approved ? amount : null,
    approved_installments: approved ? n : null,
    emi_amount: approved ? r2(amount / n) : null,
    outstanding_principal: approved ? r2(amount - paidSum) : 0,
    status,
    purpose: null,
    rejection_reason: null,
    on_insufficient_salary: "SKIP",
    created_at: `${start[0]}-${pad(start[1])}-05T09:00:00Z`,
    meta: { total_levels: 1, approved_levels: 0, ...meta },
    installments: inst,
    payments: paymentsOf(id, inst),
    skipRequests: [],
    ...rest,
  };
};

export const LOANS = [
  makeLoan(1, 4, { amount: 15000, installments: 12, status: "ACTIVE", start: [2026, 4], paid: 6, purpose: "Children's school fees for the new academic year" }),
  makeLoan(2, 4, { amount: 8000, installments: 10, status: "MODIFICATION_REQUESTED", purpose: "Home appliances", meta: { modification: { reason: "EMI is above 30% of basic — please spread it over more months.", suggested_installments: 16 } } }),
  makeLoan(3, 4, { amount: 6000, installments: 6, status: "CLOSED", start: [2025, 9], purpose: "Car repair" }),
  makeLoan(4, 4, { amount: 3000, installments: 3, status: "PENDING", start: [2026, 10], purpose: "Family travel during Eid" }),
  makeLoan(5, 3, { amount: 40000, installments: 20, status: "ACTIVE", start: [2026, 2], paid: 8, purpose: "Apartment security deposit — Dubai Marina" }),
  makeLoan(6, 9, { amount: 5000, installments: 10, status: "ACTIVE", start: [2026, 5], paid: 4, skipped: [3], purpose: "Medical expenses (family in Pakistan)" }),
  makeLoan(7, 7, { amount: 25000, installments: 12, status: "PENDING", start: [2026, 10], purpose: "Wedding expenses", meta: { total_levels: 2, approved_levels: 1 } }),
  makeLoan(8, 12, { amount: 12000, installments: 12, status: "PENDING", start: [2026, 10], purpose: "Vehicle down payment" }),
  makeLoan(9, 6, { amount: 10000, installments: 8, status: "COMPLETED", start: [2025, 11], purpose: "Visa and family relocation" }),
  makeLoan(10, 10, { amount: 20000, installments: 6, status: "REJECTED", start: [2026, 8], purpose: "Personal", rejection_reason: "Amount exceeds the 3x basic salary limit for contract staff." }),
  makeLoan(11, 5, { amount: 18000, installments: 12, status: "APPROVED", start: [2026, 11], purpose: "Master's program tuition" }),
  makeLoan(12, 8, { amount: 4000, installments: 4, status: "CANCELLED", start: [2026, 6], purpose: "Laptop purchase" }),
];

// Skip requests live on their loans; ids are global.
const addSkip = (loanId, installmentNo, status, reason) => {
  const loan = LOANS.find((l) => l.id === loanId);
  const inst = loan.installments.find((i) => i.installment_no === installmentNo);
  loan.skipRequests.push({ id: loanId * 10 + installmentNo, loan_id: loanId, installment_id: inst.id, status, reason, created_at: "2026-10-02T10:00:00Z" });
};
addSkip(1, 8, "PENDING", "School admission fees due the same month");
addSkip(5, 10, "PENDING", "Annual leave travel to India");
addSkip(6, 3, "APPROVED", "Hospital bills in Lahore");
addSkip(5, 6, "REJECTED", "Personal reasons");

const findLoan = (id) => LOANS.find((l) => l.id === Number(id)) || null;
const loanCopy = (l) => (l ? JSON.parse(JSON.stringify(l)) : null);

// scope: "mine" (MY_EMPLOYEE_ID) | "pending" | "all"
export const listLoans = ({ scope = "all", status, search } = {}) =>
  LOANS.filter(
    (l) =>
      (scope !== "mine" || l.employee_id === MY_EMPLOYEE_ID) &&
      (scope !== "pending" || l.status === "PENDING") &&
      (!status || l.status === status) &&
      (!search ||
        matches(l, search, ["loan_number", "purpose"]) ||
        matches(l.employee, search, ["full_name"])),
  )
    .slice()
    .sort((a, b) => b.id - a.id)
    .map(loanCopy);

export const getLoan = (id) => loanCopy(findLoan(id));

export const listSkipRequests = ({ status, search } = {}) =>
  LOANS.flatMap((l) =>
    l.skipRequests.map((s) => ({
      ...s,
      loan: { id: l.id, loan_number: l.loan_number, employee: l.employee },
      installment: l.installments.find((i) => i.id === s.installment_id) || null,
    })),
  )
    .filter((s) => (!status || s.status === status) && (!search || matches(s.loan, search, ["loan_number"]) || matches(s.loan.employee, search, ["full_name"])))
    .sort((a, b) => b.id - a.id);

export const applyLoan = ({ employee_id, requested_amount, requested_installments, purpose, on_insufficient_salary }) => {
  const id = nextId(LOANS);
  const loan = makeLoan(id, Number(employee_id || MY_EMPLOYEE_ID), {
    amount: Number(requested_amount),
    installments: Number(requested_installments),
    status: "PENDING",
    start: [2026, 11],
    purpose: purpose || null,
    on_insufficient_salary: on_insufficient_salary || "SKIP",
    created_at: todayIso(),
  });
  LOANS.unshift(loan);
  return loan;
};

export const resubmitLoan = (id, { requested_amount, requested_installments, purpose }) => {
  const l = findLoan(id);
  if (!l) return null;
  Object.assign(l, {
    requested_amount: Number(requested_amount),
    requested_installments: Number(requested_installments),
    purpose: purpose || l.purpose,
    status: "PENDING",
    meta: { ...l.meta, modification: null },
  });
  return l;
};

export const approveLoan = (id) => {
  const l = findLoan(id);
  if (!l) return null;
  const total = l.meta.total_levels || 1;
  const done = (l.meta.approved_levels || 0) + 1;
  if (done < total) {
    l.meta = { ...l.meta, approved_levels: done };
    return l;
  }
  const fresh = makeLoan(l.id, l.employee_id, {
    amount: l.requested_amount,
    installments: l.requested_installments,
    status: "ACTIVE",
    start: [2026, 11],
    purpose: l.purpose,
    meta: { ...l.meta, approved_levels: total },
  });
  Object.assign(l, fresh);
  return l;
};

export const rejectLoan = (id, reason) => {
  const l = findLoan(id);
  if (l) Object.assign(l, { status: "REJECTED", rejection_reason: reason || null });
  return l;
};

export const requestLoanModification = (id, { reason, suggested_installments, suggested_amount }) => {
  const l = findLoan(id);
  if (l) l.meta = { ...l.meta, modification: { reason, suggested_installments: suggested_installments ?? null, suggested_amount: suggested_amount ?? null } };
  if (l) l.status = "MODIFICATION_REQUESTED";
  return l;
};

export const requestLoanSkip = (loanId, installmentId, reason) => {
  const l = findLoan(loanId);
  if (!l) return null;
  const s = { id: nextId(LOANS.flatMap((x) => x.skipRequests)), loan_id: l.id, installment_id: Number(installmentId), status: "PENDING", reason, created_at: todayIso() };
  l.skipRequests.push(s);
  return s;
};

export const actLoanSkip = (skipId, kind) => {
  for (const l of LOANS) {
    const s = l.skipRequests.find((x) => x.id === Number(skipId));
    if (s) {
      s.status = kind === "approve" ? "APPROVED" : "REJECTED";
      if (kind === "approve") {
        const inst = l.installments.find((i) => i.id === s.installment_id);
        if (inst) inst.status = "SKIPPED";
      }
      return s;
    }
  }
  return null;
};

// ── Leave encashments ───────────────────────────────────────────────────────
const LEAVE_TYPES = { ANNUAL: { id: 1, name: "Annual Leave" }, COMP: { id: 4, name: "Compensatory Off" } };

const levels = (total, approved) =>
  Array.from({ length: total }, (_, i) => ({ level_no: i + 1, approved: i < approved ? 1 : 0, total: 1, pending: i < approved ? 0 : 1 }));

const encash = (id, empId, days, payout_month, status, extra = {}) => {
  const e = employeeById(empId);
  const dept = DEPARTMENTS.find((d) => d.id === e.department_id);
  const { approvalLevels = 1, approvedLevels = status === "PENDING" ? 0 : 1, leaveType = "ANNUAL", ...rest } = extra;
  const pending = status === "PENDING";
  return {
    id,
    code: `ENC-${String(id).padStart(4, "0")}`,
    employee_id: e.id,
    department_id: e.department_id,
    employee: { id: e.id, full_name: e.full_name, country_emp_id: e.employee_code, department: { id: dept?.id, name: dept?.name } },
    leave_type: LEAVE_TYPES[leaveType],
    days,
    payout_month,
    amount: r2((e.basic_salary / 30) * days),
    currency: "AED",
    status,
    reason: null,
    reject_reason: null,
    raised_on_behalf: false,
    created_at: "2026-09-20T09:00:00Z",
    approval_request_id: 7000 + id,
    approval: {
      can_approve: pending,
      can_reject: pending,
      current_level: pending ? approvedLevels + 1 : approvalLevels,
      levels_summary: levels(approvalLevels, status === "PENDING" ? approvedLevels : approvalLevels),
    },
    ...rest,
  };
};

export const LEAVE_ENCASHMENTS = [
  encash(1, 3, 10, "2026-11", "PENDING", { reason: "Unused annual leave before year end", created_at: "2026-10-08T09:30:00Z" }),
  encash(2, 7, 15, "2026-11", "PENDING", { reason: "Encash balance carried from 2025", approvalLevels: 2, approvedLevels: 1, created_at: "2026-10-05T11:00:00Z" }),
  encash(3, 4, 5, "2026-10", "APPROVED", { created_at: "2026-09-28T08:15:00Z" }),
  encash(4, 9, 7.5, "2026-10", "APPROVED", { raised_on_behalf: true, reason: "Raised by HR on behalf of site staff", created_at: "2026-09-25T10:00:00Z" }),
  encash(5, 8, 4, "2026-09", "PAID", { created_at: "2026-08-30T12:00:00Z" }),
  encash(6, 6, 3, "2026-09", "PAID", { leaveType: "COMP", created_at: "2026-08-22T12:00:00Z" }),
  encash(7, 12, 20, "2026-10", "REJECTED", { reject_reason: "Exceeds the 15-day yearly encashment cap.", created_at: "2026-09-18T09:00:00Z" }),
  encash(8, 5, 6, "2026-11", "CANCELLED", { reason: "Planning to take the leave instead", created_at: "2026-09-10T09:00:00Z" }),
  encash(9, 1, 8, "2026-12", "PENDING", { created_at: "2026-10-12T14:20:00Z" }),
  encash(10, 10, 2.5, "2026-08", "PAID", { leaveType: "COMP", created_at: "2026-07-26T09:00:00Z" }),
];

export const listEncashments = ({ status, payout_month, department_id, search, fy } = {}) => {
  const base = LEAVE_ENCASHMENTS.filter(
    (r) =>
      (!fy || r.payout_month.startsWith(String(fy))) &&
      (!payout_month || r.payout_month === payout_month) &&
      (!department_id || String(r.department_id) === String(department_id)) &&
      (!search || matches(r.employee, search, ["full_name", "country_emp_id"]) || matches(r, search, ["code"])),
  );
  const counts = base.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  const rows = base.filter((r) => !status || r.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { rows, counts };
};

export const actOnEncashment = (id, kind, comment) => {
  const r = LEAVE_ENCASHMENTS.find((x) => x.id === Number(id));
  if (!r) return null;
  const a = r.approval;
  if (kind === "REJECT") {
    r.status = "REJECTED";
    r.reject_reason = comment || null;
    r.approval = { ...a, can_approve: false, can_reject: false };
    return r;
  }
  const total = a.levels_summary.length;
  const level = a.current_level;
  const summary = a.levels_summary.map((l) => (l.level_no <= level ? { ...l, approved: 1, pending: 0 } : l));
  if (level < total) {
    r.approval = { ...a, current_level: level + 1, levels_summary: summary };
  } else {
    r.status = "APPROVED";
    r.approval = { ...a, can_approve: false, can_reject: false, levels_summary: summary };
  }
  return r;
};

export const cancelEncashment = (id) => {
  const r = LEAVE_ENCASHMENTS.find((x) => x.id === Number(id));
  if (r) {
    r.status = "CANCELLED";
    r.approval = { ...r.approval, can_approve: false, can_reject: false };
  }
  return r;
};

