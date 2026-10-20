"use strict";

const bcrypt = require("bcrypt");
const { seedId, deleteIds } = require("../utils/seed");

const EMPLOYER = seedId("employer:alnoor");

// The 4 test logins from docs/test-users.md (password Test@12345).
// admin@ is created with the company (owner); the other three are created here.
const NEW_USERS = [
  ["subadmin", "Omar Siddiqui", "subadmin@hrms.test", "+966500000002"],
  ["staffing", "Khalid Mansour", "staffing@hrms.test", "+966500000003"],
  ["employee", "Sara Khan", "employee@hrms.test", "+966500000004"],
];
// [user key, access level, role key]
const ACCOUNTS = [
  ["admin", "ADMIN", null],
  ["subadmin", "SUB_ADMIN", "sub-admin"],
  ["staffing", "STAFFING_COMPANY", null],
  ["employee", "GENERAL_EMPLOYEE", "employee"],
];

module.exports = {
  async up(queryInterface) {
    const password = bcrypt.hashSync("Test@12345", 10);
    await queryInterface.bulkInsert(
      "users",
      NEW_USERS.map(([key, name, email, phone_number]) => ({
        id: seedId(`user:${key}`),
        name,
        email,
        phone_number,
        phone_country: "SA",
        password,
        user_status: "ACTIVE",
        is_email_verified: true,
        signup_by: "EMAIL",
        lang_key: "EN",
      }))
    );
    await queryInterface.bulkInsert(
      "hrms_accounts",
      ACCOUNTS.map(([key, access_level, roleKey]) => ({
        id: seedId(`account:${key}`),
        user_id: seedId(`user:${key}`),
        employer_id: EMPLOYER,
        access_level,
        role_id: roleKey ? seedId(`role:${roleKey}`) : null,
        status: "ACTIVE",
        password_setup_required: false,
        password_set_at: new Date("2026-01-01T00:00:00Z"),
      }))
    );
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["hrms_accounts", ACCOUNTS.map(([key]) => seedId(`account:${key}`))],
      ["users", NEW_USERS.map(([key]) => seedId(`user:${key}`))],
    ]);
  },
};
