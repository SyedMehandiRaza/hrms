"use strict";

const { seedId, deleteIds } = require("../src/utils/seed");
const { MODULES } = require("./20261019100001-lookups");

const EMPLOYER = seedId("employer:alnoor");
const ALL = MODULES.map(([key]) => key);
const R = { can_read: true };
const RC = { can_read: true, can_create: true };
const CRU = { can_read: true, can_create: true, can_update: true };
const CRUD = { ...CRU, can_delete: true };

// role key -> [name, description, { module_key: permissions }]
const ROLES = {
  "sub-admin": [
    "Sub Admin",
    "Day-to-day administration of all modules, without delete rights.",
    Object.fromEntries(ALL.filter((key) => !["role", "module"].includes(key)).map((key) => [key, CRU])),
  ],
  "hr-officer": [
    "HR Officer",
    "Manages employees, documents, leave and attendance.",
    {
      dashboard: R,
      employee: CRUD,
      department: CRUD,
      designation: CRUD,
      document: CRUD,
      leave: CRUD,
      leave_type: CRUD,
      leave_policy: CRUD,
      leave_approval: CRU,
      attendance: CRU,
      correction: CRU,
      holiday: CRUD,
      shift: CRUD,
    },
  ],
  "payroll-officer": [
    "Payroll Officer",
    "Runs payroll and manages salary structures.",
    { dashboard: R, employee: R, attendance: R, salary: CRU, payroll: CRU, financial_year: R },
  ],
  employee: [
    "Employee",
    "Self-service access for the Employee panel.",
    { dashboard: R, leave: RC, attendance: R, correction: RC, document: RC, holiday: R },
  ],
};

const permissionRows = () =>
  Object.entries(ROLES).flatMap(([roleKey, [, , perms]]) =>
    Object.entries(perms).map(([moduleKey, p]) => ({
      id: seedId(`role-perm:${roleKey}:${moduleKey}`),
      role_id: seedId(`role:${roleKey}`),
      module_id: seedId(`module:${moduleKey}`),
      can_read: Boolean(p.can_read),
      can_create: Boolean(p.can_create),
      can_update: Boolean(p.can_update),
      can_delete: Boolean(p.can_delete),
    }))
  );

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      "roles",
      Object.entries(ROLES).map(([key, [name, description]]) => ({
        id: seedId(`role:${key}`),
        employer_id: EMPLOYER,
        name,
        description,
        is_system: true,
      }))
    );
    await queryInterface.bulkInsert("role_permissions", permissionRows());
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["role_permissions", permissionRows().map((row) => row.id)],
      ["roles", Object.keys(ROLES).map((key) => seedId(`role:${key}`))],
    ]);
  },
};
