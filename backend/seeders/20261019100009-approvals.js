"use strict";

const { seedId, deleteIds } = require("../src/utils/seed");

const EMPLOYER = seedId("employer:alnoor");

// module key -> [group name, approvers by level (employee keys)]
const GROUPS = {
  LEAVE: ["Leave Approval", ["omar", "fatima"]],
  OVERTIME: ["Overtime Approval", ["omar"]],
  CORRECTION: ["Attendance Correction Approval", ["omar"]],
  PAYROLL: ["Payroll Approval", ["noor", "omar"]],
  LOAN: ["Loan Approval", ["fatima", "noor"]],
};

const memberRows = () =>
  Object.entries(GROUPS).flatMap(([moduleKey, [, approvers]]) =>
    approvers.map((employeeKey, i) => ({
      id: seedId(`approval-member:${moduleKey}:${i + 1}`),
      approval_group_id: seedId(`approval-group:${moduleKey}`),
      employee_id: seedId(`employee:${employeeKey}`),
      level_no: i + 1,
      is_mandatory: true,
      can_skip: false,
      is_active: true,
    }))
  );

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      "hrms_approval_groups",
      Object.entries(GROUPS).map(([moduleKey, [group_name, approvers]]) => ({
        id: seedId(`approval-group:${moduleKey}`),
        employer_id: EMPLOYER,
        group_name,
        group_code: `${moduleKey}-DEFAULT`,
        module_key: moduleKey,
        scope: "GLOBAL",
        total_levels: approvers.length,
        is_active: true,
        created_by: seedId("user:admin"),
      }))
    );
    await queryInterface.bulkInsert("hrms_approval_group_members", memberRows());
    // Company-wide default group per module (no project override).
    await queryInterface.bulkInsert(
      "hrms_approval_assignments",
      Object.keys(GROUPS).map((moduleKey) => ({
        id: seedId(`approval-assignment:${moduleKey}`),
        employer_id: EMPLOYER,
        module_key: moduleKey,
        approval_group_id: seedId(`approval-group:${moduleKey}`),
        project_id: null,
        is_active: true,
      }))
    );
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["hrms_approval_assignments", Object.keys(GROUPS).map((key) => seedId(`approval-assignment:${key}`))],
      ["hrms_approval_group_members", memberRows().map((row) => row.id)],
      ["hrms_approval_groups", Object.keys(GROUPS).map((key) => seedId(`approval-group:${key}`))],
    ]);
  },
};
