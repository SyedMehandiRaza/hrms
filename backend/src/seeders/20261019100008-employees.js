"use strict";

const { seedId, json, deleteIds } = require("../utils/seed");

const EMPLOYER = seedId("employer:alnoor");
const GMS = seedId("staffing:gulf-manpower");

// key, user key (existing login) or email for a new user, code, Iqama/National ID, name, nationality, gender,
// department, designation, type, staffing?, main project, other projects, joined, basic salary
// Seeded nationalities are demonyms; the country link is set directly (countries-cities-phones D13).
const NATIONALITY_ISO2 = { Pakistani: "PK", Saudi: "SA", Indian: "IN", Egyptian: "EG", Filipino: "PH", Bangladeshi: "BD" };
const EMPLOYEES = [
  ["omar", { user: "subadmin" }, "EMP-0001", "2384710293", "Omar Siddiqui", "Pakistani", "MALE", "engineering", "Project Manager", "FULL_TIME", false, "ksp", ["jwt"], "2023-04-01", 14000],
  ["fatima", { email: "fatima.alzahrani@alnoor.test" }, "EMP-0002", "1098234756", "Fatima Al-Zahrani", "Saudi", "FEMALE", "hr", "HR Officer", "FULL_TIME", false, "ksp", [], "2022-09-11", 11000],
  ["sara", { user: "employee" }, "EMP-0003", "2457198830", "Sara Khan", "Indian", "FEMALE", "engineering", "Site Engineer", "FULL_TIME", false, "ksp", [], "2024-02-04", 9000],
  ["ali", { email: "ali.hassan@alnoor.test" }, "EMP-0004", "2519083347", "Ali Hassan", "Egyptian", "MALE", "engineering", "Site Engineer", "FULL_TIME", false, "jwt", [], "2025-01-12", 8500],
  ["noor", { email: "noor.ahmed@alnoor.test" }, "EMP-0005", "1123987456", "Noor Ahmed", "Saudi", "FEMALE", "finance", "Accountant", "FULL_TIME", false, "jwt", [], "2023-06-18", 10000],
  ["jose", { email: "jose.reyes@alnoor.test" }, "EMP-0006", "2601938475", "Jose Reyes", "Filipino", "MALE", "finance", "Payroll Specialist", "FULL_TIME", false, "ksp", [], "2024-08-25", 7500],
  ["rahim", { email: "rahim.uddin@gulfmanpower.test" }, "EMP-0007", "2709384756", "Rahim Uddin", "Bangladeshi", "MALE", null, null, "CONTRACT", true, "ksp", [], "2026-02-01", 3200],
  ["imran", { email: "imran.qureshi@gulfmanpower.test" }, "EMP-0008", "2738495061", "Imran Qureshi", "Pakistani", "MALE", null, null, "CONTRACT", true, "ksp", [], "2026-03-15", 3500],
];
const HEADS = { engineering: "omar", hr: "fatima", finance: "noor" };
// [employee, doc type, number, issue, expiry, status]
const DOCUMENTS = [
  ["omar", "IQAMA", "2384710293", "2025-04-01", "2027-03-31", "APPROVED"],
  ["omar", "PASSPORT", "AB7193846", "2021-06-10", "2031-06-09", "APPROVED"],
  ["fatima", "NATIONAL_ID", "1098234756", "2022-01-05", "2032-01-04", "APPROVED"],
  ["sara", "IQAMA", "2457198830", "2025-02-04", "2027-02-03", "APPROVED"],
  ["sara", "PASSPORT", "Z4829173", "2020-03-15", "2030-03-14", "APPROVED"],
  ["ali", "IQAMA", "2519083347", "2025-11-06", "2026-11-05", "APPROVED"],
  ["noor", "NATIONAL_ID", "1123987456", "2023-02-20", "2033-02-19", "APPROVED"],
  ["jose", "IQAMA", "2601938475", "2025-08-25", "2027-08-24", "PENDING"],
  ["rahim", "IQAMA", "2709384756", "2026-02-01", "2027-01-31", "APPROVED"],
  ["imran", "IQAMA", "2738495061", "2025-10-01", "2026-09-30", "APPROVED"],
];
const MONTHS_ACCRUED = 9; // January to September 2026
const ALI_SICK_DAYS = 1;

const userId = (e) => (e[1].user ? seedId(`user:${e[1].user}`) : seedId(`user:${e[0]}`));
const isSaudi = (e) => e[5] === "Saudi";
const own = EMPLOYEES.filter((e) => !e[10]);

const rows = () => {
  const users = EMPLOYEES.filter((e) => e[1].email).map((e) => ({
    id: seedId(`user:${e[0]}`),
    name: e[4],
    email: e[1].email,
    user_status: "ACTIVE",
    signup_by: "EMAIL",
    lang_key: "EN",
  }));
  const employees = EMPLOYEES.map((e) => ({
    id: seedId(`employee:${e[0]}`),
    user_id: userId(e),
    employer_id: EMPLOYER,
    employee_code: e[2],
    country_emp_id: e[3],
    full_name: e[4],
    nationality: e[5],
    nationality_country_id: seedId(`country:${NATIONALITY_ISO2[e[5]]}`),
    gender: e[6],
    department_id: e[7] ? seedId(`department:${e[7]}`) : null,
    designation_id: e[8] ? seedId(`designation:${e[8]}`) : null,
    employment_type: e[9],
    staffing_company_id: e[10] ? GMS : null,
    is_billable: e[10],
    shift_id: seedId("shift:general"),
    date_of_joining: e[13],
    employment_status: "ACTIVE",
    accommodation: e[10] ? "GMS Labour Camp, Al Kharj Road" : null,
  }));
  const employeeProjects = EMPLOYEES.flatMap((e) =>
    [e[11], ...e[12]].map((projectKey) => ({
      id: seedId(`employee-project:${e[0]}:${projectKey}`),
      employer_id: EMPLOYER,
      employee_id: seedId(`employee:${e[0]}`),
      project_id: seedId(`project:${projectKey}`),
      is_active: true,
      start_date: e[13],
      main_project: projectKey === e[11],
      main_project_date_start: projectKey === e[11] ? e[13] : null,
    }))
  );
  const projectHistory = employeeProjects.map((ep) => ({
    id: seedId(`project-history:${ep.id}`),
    employer_id: EMPLOYER,
    employee_id: ep.employee_id,
    project_id: ep.project_id,
    action: "ASSIGNED",
    effective_date: ep.start_date,
    actioned_by: seedId("user:admin"),
    actioned_at: new Date(`${ep.start_date}T06:00:00Z`),
  }));
  const mainPeriods = EMPLOYEES.map((e) => ({
    id: seedId(`main-period:${e[0]}`),
    employer_id: EMPLOYER,
    employee_id: seedId(`employee:${e[0]}`),
    project_id: seedId(`project:${e[11]}`),
    date_from: e[13],
    date_to: null,
  }));
  const shiftHistory = EMPLOYEES.map((e) => ({
    id: seedId(`shift-history:${e[0]}`),
    employer_id: EMPLOYER,
    employee_id: seedId(`employee:${e[0]}`),
    shift_id: seedId("shift:general"),
    effective_from: e[13],
  }));
  const salaries = EMPLOYEES.map((e) => ({
    id: seedId(`salary:${e[0]}`),
    employee_id: seedId(`employee:${e[0]}`),
    employer_id: EMPLOYER,
    currency: "SAR",
    salary_calc_mode: e[10] ? "MONTHLY_HOURLY" : "MONTHLY_FIXED",
    working_hours: 8,
    min_hours: e[10] ? 8 : null,
    effective_from: e[13],
    is_active: true,
  }));
  const salaryComponents = EMPLOYEES.flatMap((e) => {
    const line = (code, calculation_type, amount, percent_base) => ({
      id: seedId(`salary-component:${e[0]}:${code}`),
      employee_salary_id: seedId(`salary:${e[0]}`),
      salary_component_id: seedId(`component:${code}`),
      calculation_type,
      amount,
      percent_base: percent_base ? json(percent_base) : null,
    });
    if (e[10]) return [line("BASIC", "FIXED", e[14]), line("FOOD", "FIXED", 300)];
    const lines = [line("BASIC", "FIXED", e[14]), line("HOUSING", "PERCENTAGE", 25, ["BASIC"]), line("TRANSPORT", "FIXED", 800)];
    if (isSaudi(e)) lines.push(line("GOSI", "PERCENTAGE", 9.75, ["BASIC", "HOUSING"]));
    return lines;
  });
  const documents = DOCUMENTS.map(([key, code, number, issue_date, expiry_date, status]) => ({
    id: seedId(`document:${key}:${code}`),
    employer_id: EMPLOYER,
    employee_id: seedId(`employee:${key}`),
    document_type_id: seedId(`doctype:${code}`),
    document_number: number,
    issuing_authority: code === "PASSPORT" ? "Ministry of Foreign Affairs" : "Ministry of Interior, KSA",
    issue_date,
    expiry_date,
    file_name: `${code.toLowerCase()}-${key}.pdf`,
    file_type: "application/pdf",
    status,
    is_active: true,
    uploaded_by: seedId("user:admin"),
  }));
  const dependents = [
    {
      id: seedId("dependent:sara:child"),
      employee_id: seedId("employee:sara"),
      full_name: "Aarav Khan",
      relationship: "CHILD",
      date_of_birth: "2019-05-12",
      gender: "MALE",
      nationality: "Indian",
      id_details: "Iqama 4457198831",
      status: "VERIFIED",
      reviewed_by: seedId("user:admin"),
      reviewed_at: new Date("2026-02-10T08:00:00Z"),
    },
  ];
  const leavePolicies = EMPLOYEES.flatMap((e) =>
    (e[10] ? ["ANNUAL"] : ["ANNUAL", "SICK"]).map((code) => ({
      id: seedId(`employee-leave-policy:${e[0]}:${code}`),
      employer_id: EMPLOYER,
      employee_id: seedId(`employee:${e[0]}`),
      leave_policy_id: seedId(`leavepolicy:${code}`),
      effective_from: "2026-01-01",
      is_active: true,
    }))
  );
  const balances = EMPLOYEES.flatMap((e) =>
    (e[10] ? ["ANNUAL"] : ["ANNUAL", "SICK"]).map((code) => {
      const allocated = code === "ANNUAL" ? 1.75 * MONTHS_ACCRUED : 30;
      const consumed = code === "SICK" && e[0] === "ali" ? ALI_SICK_DAYS : 0;
      return {
        id: seedId(`leave-balance:${e[0]}:${code}`),
        employer_id: EMPLOYER,
        employee_id: seedId(`employee:${e[0]}`),
        leave_type_id: seedId(`leavetype:${code}`),
        leave_policy_id: seedId(`leavepolicy:${code}`),
        financial_year_id: seedId("fy:2026"),
        balance_year: 2026,
        accrued_balance: code === "ANNUAL" ? allocated : 0,
        opening_balance: code === "SICK" ? allocated : 0,
        total_allocated: allocated,
        consumed_balance: consumed,
        available_balance: allocated - consumed,
        last_accrual_date: code === "ANNUAL" ? "2026-09-30" : null,
        status: "OPEN",
      };
    })
  );
  return {
    users,
    employees,
    employeeProjects,
    projectHistory,
    mainPeriods,
    shiftHistory,
    salaries,
    salaryComponents,
    documents,
    dependents,
    leavePolicies,
    balances,
  };
};

module.exports = {
  async up(queryInterface) {
    const r = rows();
    await queryInterface.bulkInsert("users", r.users);
    await queryInterface.bulkInsert("employees", r.employees);
    for (const [deptKey, employeeKey] of Object.entries(HEADS)) {
      await queryInterface.bulkUpdate(
        "hrms_departments",
        { dept_head_id: seedId(`employee:${employeeKey}`) },
        { id: seedId(`department:${deptKey}`) }
      );
    }
    await queryInterface.bulkInsert("employee_projects", r.employeeProjects);
    await queryInterface.bulkInsert("hrms_employee_project_history", r.projectHistory);
    await queryInterface.bulkInsert("hrms_employee_main_project_periods", r.mainPeriods);
    // Employee IDs continue after the seeded EMP-0001…EMP-0008 (workforce D45).
    await queryInterface.bulkInsert("hrms_number_sequences", [
      { id: seedId("sequence:EMPLOYEE"), employer_id: EMPLOYER, doc_type: "EMPLOYEE", financial_year_id: null, last_no: EMPLOYEES.length },
    ]);
    await queryInterface.bulkInsert("hrms_employee_shift_history", r.shiftHistory);
    await queryInterface.bulkInsert("hrms_employee_salary", r.salaries);
    await queryInterface.bulkInsert("hrms_employee_salary_components", r.salaryComponents);
    await queryInterface.bulkInsert("hrms_employee_documents", r.documents);
    await queryInterface.bulkInsert("hrms_employee_dependents", r.dependents);
    await queryInterface.bulkInsert("hrms_employee_leave_policies", r.leavePolicies);
    await queryInterface.bulkInsert("hrms_leave_balances", r.balances);
  },

  async down(queryInterface) {
    const r = rows();
    await queryInterface.bulkUpdate(
      "hrms_departments",
      { dept_head_id: null },
      { id: Object.keys(HEADS).map((key) => seedId(`department:${key}`)) }
    );
    await deleteIds(queryInterface, [
      ["hrms_leave_balances", r.balances.map((x) => x.id)],
      ["hrms_employee_leave_policies", r.leavePolicies.map((x) => x.id)],
      ["hrms_employee_dependents", r.dependents.map((x) => x.id)],
      ["hrms_employee_documents", r.documents.map((x) => x.id)],
      ["hrms_employee_salary_components", r.salaryComponents.map((x) => x.id)],
      ["hrms_employee_salary", r.salaries.map((x) => x.id)],
      ["hrms_employee_shift_history", r.shiftHistory.map((x) => x.id)],
      ["hrms_number_sequences", [seedId("sequence:EMPLOYEE")]],
      ["hrms_employee_main_project_periods", r.mainPeriods.map((x) => x.id)],
      ["hrms_employee_project_history", r.projectHistory.map((x) => x.id)],
      ["employee_projects", r.employeeProjects.map((x) => x.id)],
      ["employees", r.employees.map((x) => x.id)],
      ["users", r.users.map((x) => x.id)],
    ]);
  },
};

module.exports.EMPLOYEES = EMPLOYEES;
module.exports.own = own;
