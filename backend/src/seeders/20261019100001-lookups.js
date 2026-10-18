"use strict";

const { seedId, deleteIds } = require("../utils/seed");

const COUNTRIES = [
  ["SA", "Saudi Arabia", "+966"],
  ["IN", "India", "+91"],
  ["PK", "Pakistan", "+92"],
  ["EG", "Egypt", "+20"],
  ["PH", "Philippines", "+63"],
  ["BD", "Bangladesh", "+880"],
];
const CITIES = ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Khobar"];
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
      "countries",
      COUNTRIES.map(([iso2, name, calling_code]) => ({ id: seedId(`country:${iso2}`), iso2, name, calling_code }))
    );
    await queryInterface.bulkInsert(
      "cities",
      CITIES.map((city_name) => ({
        id: seedId(`city:${city_name}`),
        country_id: seedId("country:SA"),
        city_name,
        is_active: true,
      }))
    );
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
      ["cities", CITIES.map((name) => seedId(`city:${name}`))],
      ["countries", COUNTRIES.map(([iso2]) => seedId(`country:${iso2}`))],
    ]);
  },
};
