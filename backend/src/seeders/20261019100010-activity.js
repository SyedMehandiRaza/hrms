"use strict";

const { seedId, json, deleteIds } = require("../utils/seed");
const { EMPLOYEES } = require("./20261019100008-employees");

const EMPLOYER = seedId("employer:alnoor");
const FY2026 = seedId("fy:2026");
const ADMIN = seedId("user:admin");
const emp = (key) => seedId(`employee:${key}`);
const round2 = (n) => Math.round(n * 100) / 100;

// Riyadh is UTC+3: 08:00 local = 05:00Z.
const WORK_DAYS = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
const ATTENDEES = [
  ["sara", "ksp", 24.6877, 46.7219],
  ["rahim", "ksp", 24.6878, 46.722],
  ["imran", "ksp", 24.6876, 46.7218],
  ["ali", "jwt", 21.5433, 39.1728],
];

const attendanceRows = () =>
  ATTENDEES.flatMap(([key, project, lat, lng]) =>
    WORK_DAYS.map((day, i) => {
      const missingCheckout = key === "ali" && day === "2026-10-13";
      return {
        id: seedId(`attendance:${key}:${day}`),
        employer_id: EMPLOYER,
        employee_id: emp(key),
        project_id: seedId(`project:${project}`),
        work_date: day,
        check_in_time: new Date(`${day}T04:5${i}:00Z`),
        check_in_lat: lat,
        check_in_lng: lng,
        check_out_time: missingCheckout ? null : new Date(`${day}T14:0${i}:00Z`),
        check_out_lat: missingCheckout ? null : lat,
        check_out_lng: missingCheckout ? null : lng,
        is_within_geofence: true,
        source: "ONLINE",
      };
    })
  );

// [key, employee, module, group levels, status, current level, code]
const APPROVALS = [
  ["leave-sara", "sara", "LEAVE", 2, "PENDING", 1, "LV-2026-0002"],
  ["leave-ali", "ali", "LEAVE", 2, "APPROVED", 2, "LV-2026-0001"],
  ["ot-sara", "sara", "OVERTIME", 1, "PENDING", 1, "OT-2026-0001"],
  ["corr-ali", "ali", "CORRECTION", 1, "PENDING", 1, "CR-2026-0001"],
];
const ENTITY = {
  "leave-sara": ["leave_request", seedId("leave:sara:annual")],
  "leave-ali": ["leave_request", seedId("leave:ali:sick")],
  "ot-sara": ["overtime_request", seedId("overtime:sara")],
  "corr-ali": ["correction_request", seedId("correction:ali")],
};

const approvalRows = () =>
  APPROVALS.map(([key, employeeKey, moduleKey, levels, status, level, code]) => ({
    id: seedId(`approval-request:${key}`),
    employer_id: EMPLOYER,
    approval_group_id: seedId(`approval-group:${moduleKey}`),
    module_key: moduleKey,
    entity_type: ENTITY[key][0],
    entity_id: ENTITY[key][1],
    request_code: code,
    requested_by: emp(employeeKey),
    current_level: level,
    total_levels: levels,
    final_status: status,
    requested_at: new Date("2026-10-16T06:00:00Z"),
    completed_at: status === "APPROVED" ? new Date("2026-09-07T09:00:00Z") : null,
  }));

const approvalLogRows = () =>
  APPROVALS.flatMap(([key, , moduleKey, levels, status]) => {
    const approverByLevel = { LEAVE: ["omar", "fatima"], OVERTIME: ["omar"], CORRECTION: ["omar"] }[moduleKey];
    const doneLevels = status === "APPROVED" ? levels : 0;
    return approverByLevel.slice(0, Math.max(doneLevels, 1)).map((approver, i) => ({
      id: seedId(`approval-log:${key}:${i + 1}`),
      approval_request_id: seedId(`approval-request:${key}`),
      approval_group_member_id: seedId(`approval-member:${moduleKey}:${i + 1}`),
      employee_id: emp(approver),
      level_no: i + 1,
      status: status === "APPROVED" ? "APPROVED" : "PENDING",
      acted_at: status === "APPROVED" ? new Date("2026-09-07T09:00:00Z") : null,
    }));
  });

const leaveRows = () => ({
  requests: [
    {
      id: seedId("leave:sara:annual"),
      employer_id: EMPLOYER,
      employee_id: emp("sara"),
      project_id: seedId("project:ksp"),
      leave_type_id: seedId("leavetype:ANNUAL"),
      leave_policy_id: seedId("leavepolicy:ANNUAL"),
      approval_request_id: seedId("approval-request:leave-sara"),
      request_code: "LV-2026-0002",
      from_date: "2026-10-25",
      to_date: "2026-10-27",
      total_days: 3,
      paid_days: 3,
      reason: "Family wedding in Hyderabad.",
      status: "PENDING",
      applied_at: new Date("2026-10-16T06:00:00Z"),
    },
    {
      id: seedId("leave:ali:sick"),
      employer_id: EMPLOYER,
      employee_id: emp("ali"),
      project_id: seedId("project:jwt"),
      leave_type_id: seedId("leavetype:SICK"),
      leave_policy_id: seedId("leavepolicy:SICK"),
      approval_request_id: seedId("approval-request:leave-ali"),
      request_code: "LV-2026-0001",
      from_date: "2026-09-08",
      to_date: "2026-09-08",
      total_days: 1,
      paid_days: 1,
      reason: "Fever, medical certificate attached.",
      status: "APPROVED",
      applied_at: new Date("2026-09-07T05:00:00Z"),
      approved_by: ADMIN,
      approved_at: new Date("2026-09-07T09:00:00Z"),
    },
  ],
  days: [
    ...["2026-10-25", "2026-10-26", "2026-10-27"].map((leave_date) => ({
      id: seedId(`leave-day:sara:${leave_date}`),
      employer_id: EMPLOYER,
      leave_request_id: seedId("leave:sara:annual"),
      employee_id: emp("sara"),
      leave_date,
      leave_year: 2026,
    })),
    {
      id: seedId("leave-day:ali:2026-09-08"),
      employer_id: EMPLOYER,
      leave_request_id: seedId("leave:ali:sick"),
      employee_id: emp("ali"),
      leave_date: "2026-09-08",
      leave_year: 2026,
    },
  ],
  transactions: [
    {
      id: seedId("leave-tx:ali:sick"),
      employer_id: EMPLOYER,
      employee_id: emp("ali"),
      leave_balance_id: seedId("leave-balance:ali:SICK"),
      leave_type_id: seedId("leavetype:SICK"),
      transaction_type: "DEBIT",
      leave_source: "LEAVE_REQUEST",
      transaction_date: "2026-09-07",
      days: 1,
      balance_before: 30,
      balance_after: 29,
      reference_type: "leave_request",
      reference_id: seedId("leave:ali:sick"),
      reference_code: "LV-2026-0001",
      leave_year: 2026,
      created_by: ADMIN,
    },
  ],
});

// September 2026 payroll for King Salman Park: 30 days - 4 Fridays - National Day = 25 working days.
const PAYROLL_RUN = seedId("payroll-run:2026-09:ksp");
const payrollRows = () => {
  const onKsp = EMPLOYEES.filter((e) => e[11] === "ksp");
  const payslips = [];
  const items = [];
  for (const e of onKsp) {
    const [key, , , , , nationality, , , , , isContract, , , , basic] = e;
    const earnings = isContract
      ? [["BASIC", "Basic Salary", basic], ["FOOD", "Food Allowance", 300]]
      : [["BASIC", "Basic Salary", basic], ["HOUSING", "Housing Allowance", round2(basic * 0.25)], ["TRANSPORT", "Transport Allowance", 800]];
    const deductions = nationality === "Saudi" ? [["GOSI", "GOSI Contribution", round2(basic * 1.25 * 0.0975)]] : [];
    const gross = round2(earnings.reduce((s, x) => s + x[2], 0));
    const totalDeductions = round2(deductions.reduce((s, x) => s + x[2], 0));
    const payslipId = seedId(`payslip:2026-09:${key}`);
    payslips.push({
      id: payslipId,
      run_id: PAYROLL_RUN,
      employer_id: EMPLOYER,
      employee_id: emp(key),
      gross_salary: gross,
      total_deductions: totalDeductions,
      net_salary: round2(gross - totalDeductions),
      total_working_days: 25,
      total_present_days: 25,
      total_worked_hours: 200,
      worked_hours: 200,
      status: "PENDING",
    });
    for (const [code, label, amount] of earnings) {
      items.push({ id: seedId(`payroll-item:${key}:${code}`), payroll_id: payslipId, type: "EARNING", label, salary_component_id: seedId(`component:${code}`), amount, is_auto: true });
    }
    for (const [code, label, amount] of deductions) {
      items.push({ id: seedId(`payroll-item:${key}:${code}`), payroll_id: payslipId, type: "DEDUCTION", label, salary_component_id: seedId(`component:${code}`), amount, is_auto: true });
    }
  }
  const run = {
    id: PAYROLL_RUN,
    employer_id: EMPLOYER,
    project_id: seedId("project:ksp"),
    reference_no: "PR-2026-0001",
    period_month: 9,
    period_year: 2026,
    period_start: "2026-09-01",
    period_end: "2026-09-30",
    status: "DRAFT",
    total_net: round2(payslips.reduce((s, p) => s + p.net_salary, 0)),
    generated_by: ADMIN,
    generated_at: new Date("2026-10-01T06:00:00Z"),
  };
  return { run, payslips, items };
};

// Ali: 6,000 SAR over 6 months from August 2026; August and September recovered from salary.
const LOAN = seedId("loan:ali");
const INSTALLMENT_MONTHS = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];
const loanRows = () => {
  const installments = INSTALLMENT_MONTHS.map((ym, i) => {
    const [year, month] = ym.split("-").map(Number);
    const paid = i < 2;
    return {
      id: seedId(`loan-installment:ali:${i + 1}`),
      loan_id: LOAN,
      employer_id: EMPLOYER,
      installment_no: i + 1,
      due_date: `${ym}-28`,
      period_month: month,
      period_year: year,
      emi_amount: 1000,
      principal_component: 1000,
      interest_component: 0,
      opening_balance: 6000 - i * 1000,
      closing_balance: 5000 - i * 1000,
      status: paid ? "PAID" : "PENDING",
      paid_amount: paid ? 1000 : 0,
      paid_date: paid ? `${ym}-28` : null,
    };
  });
  const payments = installments.slice(0, 2).map((inst, i) => ({
    id: seedId(`loan-payment:ali:${i + 1}`),
    employer_id: EMPLOYER,
    loan_id: LOAN,
    installment_id: inst.id,
    transaction_id: `LNPAY-2026-000${i + 1}`,
    method: "SALARY_DEDUCTION",
    period_month: inst.period_month,
    period_year: inst.period_year,
    amount: 1000,
    status: "SUCCESS",
    paid_at: new Date(`${inst.paid_date}T09:00:00Z`),
    created_by: ADMIN,
  }));
  const ledger = [
    { id: seedId("loan-ledger:ali:disbursement"), employer_id: EMPLOYER, loan_id: LOAN, entry_type: "DISBURSEMENT", direction: "DEBIT", amount: 6000, balance_after: 6000, entry_date: "2026-07-20", created_by: ADMIN },
    ...payments.map((p, i) => ({
      id: seedId(`loan-ledger:ali:payment:${i + 1}`),
      employer_id: EMPLOYER,
      loan_id: LOAN,
      entry_type: "PAYMENT",
      direction: "CREDIT",
      amount: 1000,
      installment_id: p.installment_id,
      payment_id: p.id,
      balance_after: 5000 - i * 1000,
      entry_date: installments[i].paid_date,
      created_by: ADMIN,
    })),
  ];
  const loan = {
    id: LOAN,
    employer_id: EMPLOYER,
    employee_id: emp("ali"),
    loan_number: "LN-2026-0001",
    requested_amount: 6000,
    requested_installments: 6,
    purpose: "Family medical expenses",
    approved_amount: 6000,
    approved_installments: 6,
    emi_amount: 1000,
    interest_rate: 0,
    status: "ACTIVE",
    approver_id: ADMIN,
    outstanding_principal: 4000,
    first_deduction_month: "2026-08-01",
    applied_at: new Date("2026-07-10T06:00:00Z"),
    approved_at: new Date("2026-07-15T06:00:00Z"),
    disbursed_at: new Date("2026-07-20T06:00:00Z"),
    created_by: ADMIN,
  };
  return { loan, installments, payments, ledger };
};

const otherRows = () => ({
  overtime: {
    id: seedId("overtime:sara"),
    employer_id: EMPLOYER,
    employee_id: emp("sara"),
    project_id: seedId("project:ksp"),
    work_date: "2026-10-14",
    start_time: "17:00:00",
    end_time: "19:00:00",
    overtime_hours: 2,
    reason: "Concrete pour for Block C slab had to be completed.",
    status: "PENDING",
    approval_request_id: seedId("approval-request:ot-sara"),
  },
  correction: {
    id: seedId("correction:ali"),
    employer_id: EMPLOYER,
    employee_id: emp("ali"),
    attendance_id: seedId("attendance:ali:2026-10-13"),
    work_date: "2026-10-13",
    correction_type: "ADD_CHECK_OUT",
    requested_check_out: new Date("2026-10-13T14:05:00Z"),
    reason: "Phone battery died before I could check out.",
    status: "PENDING",
    approval_request_id: seedId("approval-request:corr-ali"),
  },
  exitVisa: {
    id: seedId("exit-visa:sara"),
    employer_id: EMPLOYER,
    employee_id: emp("sara"),
    visa_type: "SINGLE_EXIT",
    status: "PENDING_APPROVAL",
    requested_from: "2026-12-20",
    requested_to: "2027-01-05",
    reason: "Family visit for winter holidays.",
    document_id: seedId("document:sara:IQAMA"),
    applied_by: seedId("user:employee"),
    applied_at: new Date("2026-10-17T07:00:00Z"),
  },
  sequences: [
    { id: seedId("sequence:PAYROLL_RUN:2026"), employer_id: EMPLOYER, doc_type: "PAYROLL_RUN", financial_year_id: FY2026, last_no: 1 },
    { id: seedId("sequence:LOAN:2026"), employer_id: EMPLOYER, doc_type: "LOAN", financial_year_id: FY2026, last_no: 1 },
  ],
  contractTypes: [
    { id: seedId("contract-type:EMP"), employer_id: EMPLOYER, name: "Employment Contract", code: "EMP", description: "Standard employment agreement", created_by: ADMIN },
    { id: seedId("contract-type:STAFF"), employer_id: EMPLOYER, name: "Staffing Agreement", code: "STAFF", description: "Manpower supply agreement with a staffing company", created_by: ADMIN },
  ],
  contractDocument: {
    id: seedId("contract-document:employment"),
    employer_id: EMPLOYER,
    name: "Standard Employment Contract",
    original_file_name: "employment-contract-v1.pdf",
    file_type: "PDF",
    mime_type: "application/pdf",
    page_count: 3,
    status: "SAVED",
    uploaded_by: ADMIN,
    meta: json({ version: 1 }),
  },
  contractTemplate: {
    id: seedId("contract-template:employment"),
    employer_id: EMPLOYER,
    document_id: seedId("contract-document:employment"),
    name: "Standard Employment Contract",
    description: "Default template for full-time employees.",
    audience_type: "EMPLOYEE",
    page_count: 3,
    status: "ACTIVE",
    created_by: ADMIN,
  },
  notification: {
    id: seedId("notification:omar:leave-sara"),
    employer_id: EMPLOYER,
    user_id: seedId("user:subadmin"),
    type: "APPROVAL_PENDING",
    title: "Leave request from Sara Khan",
    body: "Annual leave, 25-27 Oct 2026, is waiting for your approval.",
    entity_type: "approval_request",
    entity_id: seedId("approval-request:leave-sara"),
  },
});

module.exports = {
  async up(queryInterface) {
    const leave = leaveRows();
    const payroll = payrollRows();
    const loans = loanRows();
    const other = otherRows();
    await queryInterface.bulkInsert("hrms_attendance", attendanceRows());
    await queryInterface.bulkInsert("hrms_approval_requests", approvalRows());
    await queryInterface.bulkInsert("hrms_approval_request_logs", approvalLogRows());
    await queryInterface.bulkInsert("hrms_leave_requests", leave.requests);
    await queryInterface.bulkInsert("hrms_leave_request_days", leave.days);
    await queryInterface.bulkInsert("hrms_leave_balance_transactions", leave.transactions);
    await queryInterface.bulkInsert("hrms_overtime_requests", [other.overtime]);
    await queryInterface.bulkInsert("hrms_attendance_correction_requests", [other.correction]);
    await queryInterface.bulkInsert("hrms_payroll_runs", [payroll.run]);
    await queryInterface.bulkInsert("hrms_payroll", payroll.payslips);
    await queryInterface.bulkInsert("hrms_payroll_items", payroll.items);
    await queryInterface.bulkInsert("hrms_loans", [loans.loan]);
    await queryInterface.bulkInsert("hrms_loan_installments", loans.installments);
    await queryInterface.bulkInsert("hrms_loan_payments", loans.payments);
    await queryInterface.bulkInsert("hrms_loan_ledger", loans.ledger);
    await queryInterface.bulkInsert("hrms_exit_visas", [other.exitVisa]);
    await queryInterface.bulkInsert("hrms_number_sequences", other.sequences);
    await queryInterface.bulkInsert("hrms_contract_types", other.contractTypes);
    await queryInterface.bulkInsert("hrms_contract_documents", [other.contractDocument]);
    await queryInterface.bulkInsert("hrms_contract_templates", [other.contractTemplate]);
    await queryInterface.bulkInsert("notifications", [other.notification]);
  },

  async down(queryInterface) {
    const leave = leaveRows();
    const payroll = payrollRows();
    const loans = loanRows();
    const other = otherRows();
    await deleteIds(queryInterface, [
      ["notifications", [other.notification.id]],
      ["hrms_contract_templates", [other.contractTemplate.id]],
      ["hrms_contract_documents", [other.contractDocument.id]],
      ["hrms_contract_types", other.contractTypes.map((x) => x.id)],
      ["hrms_number_sequences", other.sequences.map((x) => x.id)],
      ["hrms_exit_visas", [other.exitVisa.id]],
      ["hrms_loan_ledger", loans.ledger.map((x) => x.id)],
      ["hrms_loan_payments", loans.payments.map((x) => x.id)],
      ["hrms_loan_installments", loans.installments.map((x) => x.id)],
      ["hrms_loans", [loans.loan.id]],
      ["hrms_payroll_items", payroll.items.map((x) => x.id)],
      ["hrms_payroll", payroll.payslips.map((x) => x.id)],
      ["hrms_payroll_runs", [payroll.run.id]],
      ["hrms_attendance_correction_requests", [other.correction.id]],
      ["hrms_overtime_requests", [other.overtime.id]],
      ["hrms_leave_balance_transactions", leave.transactions.map((x) => x.id)],
      ["hrms_leave_request_days", leave.days.map((x) => x.id)],
      ["hrms_leave_requests", leave.requests.map((x) => x.id)],
      ["hrms_approval_request_logs", approvalLogRows().map((x) => x.id)],
      ["hrms_approval_requests", approvalRows().map((x) => x.id)],
      ["hrms_attendance", attendanceRows().map((x) => x.id)],
    ]);
  },
};
