"use strict";

const { seedId, deleteIds } = require("../utils/seed");

// Countries and cities are reference data loaded by migration 20261020500002 (same ids as before:
// seedId("country:<ISO2>") and seedId("city:<name>") for the first six Saudi cities).
const INDUSTRIES = ["Construction", "Oil & Gas", "Facilities Management", "Manufacturing"];
// Mirrors hrms/src/constants/permissions.js MODULES (minus keys of removed duplicate tables).
const MODULES = [
  ["dashboard", "Dashboard"],
  ["employee", "Employees"],
  ["department", "Departments"],
  ["designation", "Designations"],
  ["project", "Projects"],
  ["office", "Head Offices"],
  ["shift", "Shifts"],
  ["holiday", "Holidays"],
  ["attendance", "Attendance"],
  ["correction", "Attendance Corrections"],
  ["leave", "Leave"],
  ["leave_type", "Leave Types"],
  ["leave_policy", "Leave Policies"],
  ["leave_approval", "Leave Approvals"],
  ["approval_group", "Approval Groups"],
  ["salary", "Salary"],
  ["payroll", "Payroll"],
  ["document", "Documents"],
  ["contract", "Contracts"],
  ["staffing_company", "Staffing Companies"],
  ["notification", "Notifications"],
  ["financial_year", "Financial Year"],
  ["role", "Roles & Permissions"],
  ["module", "Modules"],
];

module.exports = {
  MODULES,

  async up(queryInterface) {
    await queryInterface.bulkInsert(
      "industry_types",
      INDUSTRIES.map((industry_name) => ({ id: seedId(`industry:${industry_name}`), industry_name }))
    );
    await queryInterface.bulkInsert(
      "modules",
      MODULES.map(([module_key, name], i) => ({ id: seedId(`module:${module_key}`), module_key, name, sort_order: i + 1 }))
    );
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["modules", MODULES.map(([key]) => seedId(`module:${key}`))],
      ["industry_types", INDUSTRIES.map((name) => seedId(`industry:${name}`))],
    ]);
  },
};
