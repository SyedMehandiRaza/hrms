"use strict";

const { seedId, deleteIds } = require("../utils/seed");

const EMPLOYER = seedId("employer:alnoor");

// [code, label, category, requires_number, requires_expiry, requires_issuer]
const DOCUMENT_TYPES = [
  ["IQAMA", "Iqama", "IDENTITY", true, true, true],
  ["PASSPORT", "Passport", "IDENTITY", true, true, true],
  ["NATIONAL_ID", "National ID", "IDENTITY", true, true, false],
  ["DRIVER_LICENSE", "Driver's License", "LEGAL", true, true, true],
  ["WORK_PERMIT", "Work Permit", "LEGAL", true, true, true],
  ["TAX_FORM", "Tax Form", "GENERAL", false, false, false],
];
// [code, name, type]
const SALARY_COMPONENTS = [
  ["BASIC", "Basic Salary", "EARNING"],
  ["HOUSING", "Housing Allowance", "EARNING"],
  ["TRANSPORT", "Transport Allowance", "EARNING"],
  ["FOOD", "Food Allowance", "EARNING"],
  ["GOSI", "GOSI Contribution", "DEDUCTION"],
  ["ADVANCE", "Salary Advance Recovery", "DEDUCTION"],
];
// [code, name, is_paid, allow_half_day, requires_document, yearly_quota, monthly_accrual, carry, negative]
const LEAVE_TYPES = [
  ["ANNUAL", "Annual Leave", true, true, false, 21, 1.75, true, false],
  ["SICK", "Sick Leave", true, true, true, 30, 0, false, false],
  ["UNPAID", "Unpaid Leave", false, false, false, 0, 0, false, true],
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      "hrms_document_types",
      DOCUMENT_TYPES.map(([code, label, category, requires_number, requires_expiry, requires_issuer]) => ({
        id: seedId(`doctype:${code}`),
        employer_id: EMPLOYER,
        code,
        label,
        category,
        requires_number,
        requires_expiry,
        requires_issuer,
        is_system: true,
      }))
    );
    await queryInterface.bulkInsert(
      "hrms_salary_components",
      SALARY_COMPONENTS.map(([code, name, type]) => ({
        id: seedId(`component:${code}`),
        employer_id: EMPLOYER,
        code,
        name,
        type,
        is_system: code === "BASIC",
      }))
    );
    await queryInterface.bulkInsert(
      "hrms_leave_types",
      LEAVE_TYPES.map(([code, name, is_paid, allow_half_day, requires_document]) => ({
        id: seedId(`leavetype:${code}`),
        employer_id: EMPLOYER,
        leave_code: code,
        leave_name: name,
        is_paid,
        allow_half_day,
        requires_document,
      }))
    );
    await queryInterface.bulkInsert(
      "hrms_leave_policies",
      LEAVE_TYPES.map(([code, name, , , , yearly_quota, monthly_accrual, carry, negative]) => ({
        id: seedId(`leavepolicy:${code}`),
        employer_id: EMPLOYER,
        leave_type_id: seedId(`leavetype:${code}`),
        policy_name: `${name} Policy`,
        yearly_quota,
        monthly_accrual,
        accrual_method: monthly_accrual > 0 ? "MONTHLY_ACCRUAL" : "UPFRONT",
        allow_carry_forward: carry,
        max_carry_forward_days: carry ? 10 : 0,
        carry_forward_expiry_months: carry ? 3 : 0,
        allow_negative_balance: negative,
        allow_encashment: code === "ANNUAL",
        max_encashment_days: code === "ANNUAL" ? 10 : 0,
        effective_from: "2026-01-01",
      }))
    );
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["hrms_leave_policies", LEAVE_TYPES.map(([code]) => seedId(`leavepolicy:${code}`))],
      ["hrms_leave_types", LEAVE_TYPES.map(([code]) => seedId(`leavetype:${code}`))],
      ["hrms_salary_components", SALARY_COMPONENTS.map(([code]) => seedId(`component:${code}`))],
      ["hrms_document_types", DOCUMENT_TYPES.map(([code]) => seedId(`doctype:${code}`))],
    ]);
  },
};
