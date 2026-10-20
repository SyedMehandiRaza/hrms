"use strict";

const { seedId, deleteIds } = require("../utils/seed");

const EMPLOYER = seedId("employer:alnoor");

const { EMPLOYEES } = require("./20261019100008-employees");

// One group approves every request (ADR 0011): key -> [group name, code, approvers by level].
const GROUPS = {
  ALL: ["General Approval", "GENERAL", ["omar", "fatima"]],
};

const memberRows = () =>
  Object.entries(GROUPS).flatMap(([moduleKey, [, , approvers]]) =>
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

const routingRows = () =>
  EMPLOYEES.map(([key]) => ({
    id: seedId(`approval-routing:${key}`),
    employer_id: EMPLOYER,
    employee_id: seedId(`employee:${key}`),
    module_key: "ALL",
    approval_group_id: seedId("approval-group:ALL"),
  }));

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      "hrms_approval_groups",
      Object.entries(GROUPS).map(([moduleKey, [group_name, group_code, approvers]]) => ({
        id: seedId(`approval-group:${moduleKey}`),
        employer_id: EMPLOYER,
        group_name,
        group_code,
        module_key: moduleKey,
        scope: "GLOBAL",
        total_levels: approvers.length,
        is_active: true,
        created_by: seedId("user:admin"),
      }))
    );
    await queryInterface.bulkInsert("hrms_approval_group_members", memberRows());
    // Every seeded employee's single routing row (module_key ALL).
    await queryInterface.bulkInsert("employee_approval_routing", routingRows());
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["employee_approval_routing", routingRows().map((row) => row.id)],
      ["hrms_approval_group_members", memberRows().map((row) => row.id)],
      ["hrms_approval_groups", Object.keys(GROUPS).map((key) => seedId(`approval-group:${key}`))],
    ]);
  },
};
