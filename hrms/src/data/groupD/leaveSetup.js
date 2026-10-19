// Static data for group D — leave types/policies, balances, holidays, the
// calendar's leave entries and leave encashment. Shapes mirror the backend
// serializers (leaveType / leaveBalance / leaveEncashment / holiday services).
import { EMPLOYEES } from "../common.js";

const r2 = (n) => Math.round(Number(n) * 100) / 100;

// ── Leave types + their primary policy ──────────────────────────────────────
const policy = (id, extra) => ({
  id,
  policy_name: "",
  yearly_quota: "0.00",
  monthly_accrual: "0.00",
  accrual_frequency: "MONTHLY",
  accrual_day: 1,
  allow_carry_forward: false,
  max_carry_forward_days: "0.00",
  allow_encashment: false,
  max_encashment_days: "0.00",
  allow_negative_balance: false,
  effective_from: "2026-01-01",
  effective_to: null,
  carry_forward_expiry_months: 0,
  year_end_excess: "LAPSE",
  accrual_method: "MONTHLY_ACCRUAL",
  prorate_joiners: true,
  is_active: true,
  ...extra,
});

const leaveType = (id, leave_name, leave_code, description, flags, p) => {
  const pol = { ...p, policy_name: `${leave_name} Policy` };
  return {
    id,
    leave_name,
    leave_code,
    description,
    is_paid: true,
    allow_half_day: false,
    requires_document: false,
    is_active: true,
    ...flags,
    // list-row fields (GET /leave-types) …
    yearly_quota: pol.yearly_quota,
    allow_carry_forward: pol.allow_carry_forward,
    max_carry_forward_days: pol.allow_carry_forward ? Number(pol.max_carry_forward_days) : null,
    allow_encashment: pol.allow_encashment,
    // … plus the primary policy (GET /leave-types/:id)
    policy: pol,
  };
};

export const LS_LEAVE_TYPES = [
  leaveType(1, "Annual Leave", "AL", "Paid vacation leave as per UAE Labour Law — 30 calendar days per year after one year of service.", { allow_half_day: true }, policy(101, {
    yearly_quota: "30.00", monthly_accrual: "2.50", allow_carry_forward: true, max_carry_forward_days: "10.00",
    carry_forward_expiry_months: 3, allow_encashment: true, max_encashment_days: "10.00", year_end_excess: "ENCASH",
  })),
  leaveType(2, "Sick Leave", "SL", "Medical leave supported by a certificate from a licensed clinic.", { allow_half_day: true, requires_document: true }, policy(102, {
    yearly_quota: "15.00", monthly_accrual: "1.25", effective_from: "2025-01-01", accrual_method: "UPFRONT",
  })),
  leaveType(3, "Unpaid Leave", "UL", "Leave without pay, subject to manager approval.", { is_paid: false }, policy(103, {
    yearly_quota: "30.00", accrual_method: "UPFRONT", prorate_joiners: false,
  })),
  leaveType(4, "Hajj Leave", "HJ", "Once-in-service leave to perform Hajj.", { requires_document: true }, policy(104, {
    yearly_quota: "30.00", accrual_method: "UPFRONT", prorate_joiners: false,
  })),
  leaveType(5, "Maternity Leave", "ML", "60 days of maternity leave (45 fully paid, 15 half paid).", { requires_document: true }, policy(105, {
    yearly_quota: "60.00", accrual_method: "UPFRONT", prorate_joiners: false,
  })),
  leaveType(6, "Compassionate Leave", "CL", "Bereavement leave for the loss of a family member.", {}, policy(106, {
    yearly_quota: "5.00", accrual_method: "UPFRONT",
  })),
  leaveType(7, "Compensatory Off", "CO", "Time off earned for working on weekends or public holidays.", { allow_half_day: true }, policy(107, {
    yearly_quota: "12.00", monthly_accrual: "1.00", allow_encashment: true, max_encashment_days: "5.00",
  })),
  leaveType(8, "Study Leave", "STL", "Exam leave for approved degree programmes (retired in 2026).", { is_active: false }, policy(108, {
    yearly_quota: "10.00", accrual_method: "UPFRONT", is_active: false, effective_to: "2026-06-30",
  })),
];

// Policy versions (GET /leave-policies/:id/versions), oldest → newest.
export const LS_POLICY_VERSIONS = {
  101: [
    { id: 91, effective_from: "2024-01-01", effective_to: "2025-12-31", yearly_quota: "26.00" },
    { id: 101, effective_from: "2026-01-01", effective_to: null, yearly_quota: "30.00" },
  ],
  102: [{ id: 102, effective_from: "2025-01-01", effective_to: null, yearly_quota: "15.00" }],
  108: [{ id: 108, effective_from: "2026-01-01", effective_to: "2026-06-30", yearly_quota: "10.00" }],
};

// ── Leave balances (FY 2026) ────────────────────────────────────────────────
export const LS_BALANCE_YEAR = 2026;

const typeById = (id) => LS_LEAVE_TYPES.find((t) => t.id === id);

// [typeId, allocated, used, carry_forward, carry_forward_used, expires_on]
const balanceRow = (empId, [typeId, allocated, used, cf = 0, cfUsed = 0, expires = null]) => {
  const lt = typeById(typeId);
  return {
    balance_id: empId * 100 + typeId,
    balance_status: "OPEN",
    carry_forward: cf,
    carry_forward_used: cfUsed,
    carry_forward_expires_on: expires,
    id: lt.id,
    name: lt.leave_name,
    leave_name: lt.leave_name,
    code: lt.leave_code,
    is_paid: lt.is_paid,
    allow_half_day: lt.allow_half_day,
    requires_document: lt.requires_document,
    balance: r2(allocated - used),
    allocated,
    used,
  };
};

const BALANCE_PLAN = {
  1: [[1, 35, 12, 5, 5, "2026-03-31"], [2, 15, 2], [3, 30, 0], [6, 5, 0], [7, 6, 1]],
  2: [[1, 38, 9, 8, 3, "2026-12-31"], [2, 15, 0], [5, 60, 0], [3, 30, 0], [6, 5, 3]],
  3: [[1, 30, 21], [2, 15, 6], [3, 30, 2], [7, 4, 0]],
  4: [[1, 34, 11.5, 4, 1, "2026-12-31"], [2, 15, 3.5], [3, 30, 0], [4, 30, 0], [5, 60, 0], [6, 5, 0], [7, 8, 2]],
  5: [[1, 30, 14], [2, 15, 1], [3, 30, 0], [4, 30, 30]],
  6: [[1, 25, 10], [2, 15, 4], [5, 60, 0], [3, 30, 0]],
  7: [[1, 40, 16, 10, 10, "2026-03-31"], [2, 15, 0], [4, 30, 0], [3, 30, 5]],
  8: [[1, 22.5, 6], [2, 15, 2], [3, 30, 0]],
  9: [[1, 17.5, 3], [2, 15, 0], [3, 30, 0]],
  10: [[1, 15, 15], [2, 15, 8], [3, 30, 3]],
  11: [],
  12: [[1, 30, 4], [2, 15, 1], [3, 30, 0], [7, 6, 0]],
};

const employeeBalances = (emp) => {
  const leave_balances = (BALANCE_PLAN[emp.id] || []).map((spec) => balanceRow(emp.id, spec));
  const sum = (k) => r2(leave_balances.reduce((s, b) => s + Number(b[k] || 0), 0));
  return {
    employee: { id: emp.id, name: emp.full_name, profile_url: emp.profile_image },
    total_allocated: sum("allocated"),
    total_consumed: sum("used"),
    total_available_balance: sum("balance"),
    leave_balances,
  };
};

// Company-wide (LeaveCalender's Employee Balances table).
export const LS_ALL_LEAVE_BALANCES = EMPLOYEES.map(employeeBalances);

// The logged-in employee's own balances (Sara Khan, EMP-0004).
const ME = EMPLOYEES.find((e) => e.id === 4);
const myRow = employeeBalances(ME);
export const LS_MY_LEAVE_BALANCES = {
  employee: { id: ME.id, name: ME.full_name },
  balance_year: LS_BALANCE_YEAR,
  total_available_balance: myRow.total_available_balance,
  leave_balances: myRow.leave_balances,
};

// ── Holidays (UAE public holidays 2026 + company days) ──────────────────────
export const LS_HOLIDAYS = [
  { id: 1, holiday_name: "New Year's Day", holiday_date: "2026-01-01", holiday_type: "PUBLIC" },
  { id: 2, holiday_name: "Eid al-Fitr", holiday_date: "2026-03-20", holiday_type: "FESTIVAL" },
  { id: 3, holiday_name: "Eid al-Fitr Holiday", holiday_date: "2026-03-21", holiday_type: "FESTIVAL" },
  { id: 4, holiday_name: "Eid al-Fitr Holiday", holiday_date: "2026-03-22", holiday_type: "FESTIVAL" },
  { id: 5, holiday_name: "Arafat Day", holiday_date: "2026-05-26", holiday_type: "PUBLIC" },
  { id: 6, holiday_name: "Eid al-Adha", holiday_date: "2026-05-27", holiday_type: "FESTIVAL" },
  { id: 7, holiday_name: "Eid al-Adha Holiday", holiday_date: "2026-05-28", holiday_type: "FESTIVAL" },
  { id: 8, holiday_name: "Eid al-Adha Holiday", holiday_date: "2026-05-29", holiday_type: "FESTIVAL" },
  { id: 9, holiday_name: "Islamic New Year", holiday_date: "2026-06-16", holiday_type: "PUBLIC" },
  { id: 10, holiday_name: "Prophet's Birthday", holiday_date: "2026-08-25", holiday_type: "PUBLIC" },
  { id: 11, holiday_name: "Company Foundation Day", holiday_date: "2026-10-28", holiday_type: "COMPANY" },
  { id: 12, holiday_name: "Commemoration Day", holiday_date: "2026-12-01", holiday_type: "NATIONAL" },
  { id: 13, holiday_name: "UAE National Day", holiday_date: "2026-12-02", holiday_type: "NATIONAL" },
  { id: 14, holiday_name: "UAE National Day Holiday", holiday_date: "2026-12-03", holiday_type: "NATIONAL" },
  { id: 15, holiday_name: "New Year's Day", holiday_date: "2027-01-01", holiday_type: "PUBLIC" },
];

// ── Leave entries for the calendar / on-leave-today / recent requests ──────
const entry = (id, empId, typeId, from_date, to_date, total_days, status) => {
  const emp = EMPLOYEES.find((e) => e.id === empId);
  return {
    id,
    employee_id: empId,
    employee_name: emp.full_name,
    profile_url: emp.profile_image,
    leave_type_id: typeId,
    leave_type: typeById(typeId).leave_name,
    from_date,
    to_date,
    total_days,
    status,
  };
};

// Newest first (the "Recent Requests" order).
export const LS_CALENDAR_LEAVES = [
  entry(1, 6, 1, "2026-11-09", "2026-11-12", 4, "PENDING"),
  entry(2, 4, 2, "2026-10-19", "2026-10-19", 1, "PENDING"),
  entry(3, 3, 1, "2026-10-14", "2026-10-22", 9, "APPROVED"),
  entry(4, 9, 2, "2026-10-16", "2026-10-18", 3, "APPROVED"),
  entry(5, 12, 7, "2026-10-17", "2026-10-17", 1, "APPROVED"),
  entry(6, 8, 6, "2026-10-26", "2026-10-28", 3, "APPROVED"),
  entry(7, 10, 3, "2026-10-05", "2026-10-07", 3, "APPROVED"),
  entry(8, 5, 1, "2026-10-01", "2026-10-02", 2, "REJECTED"),
  entry(9, 1, 1, "2026-09-14", "2026-09-24", 11, "APPROVED"),
  entry(10, 7, 1, "2026-08-02", "2026-08-13", 12, "APPROVED"),
  entry(11, 2, 2, "2026-07-08", "2026-07-09", 2, "APPROVED"),
  entry(12, 5, 4, "2026-05-20", "2026-06-18", 30, "APPROVED"),
  entry(13, 6, 1, "2026-04-06", "2026-04-10", 5, "APPROVED"),
  entry(14, 4, 1, "2026-03-23", "2026-03-26", 4, "APPROVED"),
  entry(15, 3, 2, "2026-02-11", "2026-02-12", 2, "APPROVED"),
  entry(16, 10, 1, "2026-01-18", "2026-01-29", 12, "APPROVED"),
  entry(17, 9, 1, "2026-12-20", "2026-12-31", 12, "PENDING"),
  entry(18, 12, 2, "2026-11-03", "2026-11-03", 1, "CANCELLED"),
];

// ── Leave encashment ────────────────────────────────────────────────────────
// The employee's own requests (GET /leave-encashments/my), newest first.
const encash = (id, typeId, days, payout_month, daily_rate, status, created_at, extra = {}) => ({
  id,
  code: `ENC-${String(id).padStart(4, "0")}`,
  employee: { id: ME.id, full_name: ME.full_name, country_emp_id: ME.employee_code, department: { id: ME.department.id, name: ME.department.name } },
  leave_type: { id: typeId, name: typeById(typeId).leave_name },
  days,
  payout_month,
  daily_rate,
  amount_estimated: r2(days * daily_rate),
  amount_final: status === "PAID" ? r2(days * daily_rate) : null,
  amount: r2(days * daily_rate),
  currency: "AED",
  status,
  reason: null,
  reject_reason: null,
  raised_on_behalf: false,
  approval_request_id: null,
  salary_transaction_id: null,
  approved_at: null,
  cancelled_at: null,
  created_at,
  can_cancel: status === "PENDING",
  ...extra,
});

const MY_DAILY_RATE = r2((ME.gross_salary * 12) / 365);

export const LS_MY_ENCASHMENTS = [
  encash(6, 7, 2, "2026-11", MY_DAILY_RATE, "PENDING", "2026-10-12T09:20:00Z", { reason: "Weekend site support in September" }),
  encash(5, 1, 3, "2026-10", MY_DAILY_RATE, "APPROVED", "2026-09-28T11:05:00Z", { approved_at: "2026-09-30T08:00:00Z" }),
  encash(4, 1, 1, "2026-06", MY_DAILY_RATE, "PAID", "2026-05-18T07:45:00Z", { approved_at: "2026-05-20T10:00:00Z" }),
  encash(3, 1, 5, "2026-04", MY_DAILY_RATE, "REJECTED", "2026-03-30T13:10:00Z", { reject_reason: "Exceeds the yearly encashment cap for the quarter." }),
  encash(2, 7, 1, "2026-03", MY_DAILY_RATE, "CANCELLED", "2026-02-22T06:30:00Z", { cancelled_at: "2026-02-23T09:00:00Z" }),
  encash(1, 1, 4, "2025-12", r2((12000 * 12) / 365), "PAID", "2025-11-20T08:15:00Z", { approved_at: "2025-11-24T08:15:00Z" }),
];

// Employees for the admin's on-behalf picker.
export const LS_ENCASH_EMPLOYEES = EMPLOYEES.map((e) => ({ ...e, country_emp_id: e.employee_code }));

const ENCASH_MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"];

// GET /leave-encashments/options (self) or ?employee_id= (admin).
export const LS_encashmentOptions = (employeeId) => {
  const emp = EMPLOYEES.find((e) => e.id === Number(employeeId || ME.id)) || ME;
  const rate = r2((emp.gross_salary * 12) / 365);
  const balances = (BALANCE_PLAN[emp.id] || []).map((spec) => balanceRow(emp.id, spec));
  const mine = emp.id === ME.id ? LS_MY_ENCASHMENTS : [];
  const months = ENCASH_MONTHS.map((month) => ({ month, open: month !== "2026-09", daily_rate: rate, currency: "AED" }));
  const leave_types = balances
    .map((b) => {
      const lt = typeById(b.id);
      if (!lt.policy.allow_encashment) return null;
      const reqs = mine.filter((r) => r.leave_type.id === lt.id && r.payout_month.startsWith("2026"));
      const already = r2(reqs.filter((r) => ["PENDING", "APPROVED", "PAID"].includes(r.status)).reduce((s, r) => s + r.days, 0));
      const max = Number(lt.policy.max_encashment_days);
      const left = max > 0 ? r2(Math.max(0, max - already)) : null;
      const encashable_max = r2(Math.max(0, left === null ? b.balance : Math.min(b.balance, left)));
      return {
        leave_type_id: lt.id,
        leave_name: lt.leave_name,
        encashable: true,
        available: b.balance,
        max_days: max,
        already_encashed: already,
        has_pending: reqs.some((r) => r.status === "PENDING"),
        encashable_max,
        estimates: months.filter((m) => m.open).map((m) => ({ month: m.month, daily_rate: m.daily_rate, max_amount: r2(encashable_max * m.daily_rate) })),
      };
    })
    .filter(Boolean);
  return {
    employee: {
      id: emp.id,
      full_name: emp.full_name,
      employment_status: emp.status === "INACTIVE" ? "INACTIVE" : emp.id === 9 ? "IN_NOTICE" : "ACTIVE",
      last_working_day: emp.id === 9 ? "2026-11-30" : null,
    },
    financial_year: { id: 2, year_key: 2026, label: "FY 2026", end_date: "2026-12-31" },
    currency: "AED",
    min_month: ENCASH_MONTHS[0],
    max_month: ENCASH_MONTHS[ENCASH_MONTHS.length - 1],
    months,
    closed_months: months.filter((m) => !m.open).map((m) => m.month),
    leave_types,
  };
};
