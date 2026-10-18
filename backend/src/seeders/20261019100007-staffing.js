"use strict";

const { seedId, deleteIds } = require("../utils/seed");

const EMPLOYER = seedId("employer:alnoor");
const COMPANY = seedId("staffing:gulf-manpower");

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("hrms_staffing_companies", [
      {
        id: COMPANY,
        employer_id: EMPLOYER,
        user_id: seedId("user:staffing"),
        name: "Gulf Manpower Services",
        code: "GMS",
        email: "ops@gulfmanpower.test",
        phone: "+966138765432",
        contact_person_name: "Khalid Mansour",
        contact_person_email: "staffing@hrms.test",
        contact_person_phone: "+966500000003",
        city: "Dammam",
        address: "Industrial City 2, Dammam",
        status: "ACTIVE",
        login_enabled: true,
        must_change_password: false,
      },
    ]);
    await queryInterface.bulkInsert("hrms_staffing_company_projects", [
      {
        id: seedId("staffing-project:gms:ksp"),
        employer_id: EMPLOYER,
        staffing_company_id: COMPANY,
        project_id: seedId("project:ksp"),
        is_active: true,
      },
    ]);
    await queryInterface.bulkInsert("hrms_staffing_rates", [
      {
        id: seedId("staffing-rate:gms:hourly"),
        employer_id: EMPLOYER,
        staffing_company_id: COMPANY,
        rate_type: "HOURLY_BILL",
        value: 28.5,
        effective_from: "2026-01-01",
      },
      {
        id: seedId("staffing-rate:gms:ot"),
        employer_id: EMPLOYER,
        staffing_company_id: COMPANY,
        rate_type: "OVERTIME_MULTIPLIER",
        value: 1.5,
        effective_from: "2026-01-01",
      },
    ]);
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["hrms_staffing_rates", [seedId("staffing-rate:gms:hourly"), seedId("staffing-rate:gms:ot")]],
      ["hrms_staffing_company_projects", [seedId("staffing-project:gms:ksp")]],
      ["hrms_staffing_companies", [COMPANY]],
    ]);
  },
};
