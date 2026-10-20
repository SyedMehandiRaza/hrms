"use strict";

const bcrypt = require("bcrypt");
const { seedId, deleteIds } = require("../utils/seed");

const EMPLOYER = seedId("employer:alnoor");
const ADMIN_USER = seedId("user:admin");
const CHECKLIST = [
  ["ASSETS", "Laptop and phone returned"],
  ["ASSETS", "Site PPE and access card returned"],
  ["FINANCE", "Outstanding advances settled"],
  ["LOAN", "Active loans recovered or written off"],
  ["IT", "Email and system access revoked"],
  ["HR", "Exit interview completed"],
];

module.exports = {
  async up(queryInterface) {
    // The company owner (ADMIN login, see docs/test-users.md).
    await queryInterface.bulkInsert("users", [
      {
        id: ADMIN_USER,
        name: "Ahmed Al-Harbi",
        email: "admin@hrms.test",
        phone_number: "+966500000001",
        phone_country: "SA",
        password: bcrypt.hashSync("Test@12345", 10),
        user_status: "ACTIVE",
        is_email_verified: true,
        signup_by: "EMAIL",
        lang_key: "EN",
      },
    ]);
    await queryInterface.bulkInsert("employers", [
      {
        id: EMPLOYER,
        user_id: ADMIN_USER,
        industry_type_id: seedId("industry:Construction"),
        company_name: "Al Noor Construction",
        contact_person_name: "Ahmed Al-Harbi",
        company_email: "info@alnoor.test",
        company_phone_number: "+966112345678",
        phone_country: "SA",
        company_website: "https://alnoor.test",
        address: "King Fahd Road, Al Olaya, Riyadh 12211",
        is_company_verified: true,
        employer_status: "ACTIVE",
      },
    ]);
    await queryInterface.bulkInsert("hrms_company_time_settings", [
      { id: seedId("time-settings:alnoor"), employer_id: EMPLOYER, timezone: "Asia/Riyadh", fy_start_month: 1 },
    ]);
    await queryInterface.bulkInsert("hrms_financial_years", [
      {
        id: seedId("fy:2026"),
        employer_id: EMPLOYER,
        year_key: 2026,
        label: "FY 2026",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        status: "OPEN",
        opened_at: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: seedId("fy:2027"),
        employer_id: EMPLOYER,
        year_key: 2027,
        label: "FY 2027",
        start_date: "2027-01-01",
        end_date: "2027-12-31",
        status: "PLANNED",
      },
    ]);
    await queryInterface.bulkInsert("hrms_exit_settings", [{ id: seedId("exit-settings:alnoor"), employer_id: EMPLOYER }]);
    await queryInterface.bulkInsert(
      "hrms_exit_checklist_templates",
      CHECKLIST.map(([category, label], i) => ({
        id: seedId(`checklist:${label}`),
        employer_id: EMPLOYER,
        category,
        label,
        sort_order: i + 1,
      }))
    );
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["hrms_exit_checklist_templates", CHECKLIST.map(([, label]) => seedId(`checklist:${label}`))],
      ["hrms_exit_settings", [seedId("exit-settings:alnoor")]],
      ["hrms_financial_years", [seedId("fy:2026"), seedId("fy:2027")]],
      ["hrms_company_time_settings", [seedId("time-settings:alnoor")]],
      ["employers", [EMPLOYER]],
      ["users", [ADMIN_USER]],
    ]);
  },
};
