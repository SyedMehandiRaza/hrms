"use strict";

const { seedId, deleteIds } = require("../utils/seed");

const EMPLOYER = seedId("employer:alnoor");

const DEPARTMENTS = {
  engineering: ["Engineering", "ENG", ["Site Engineer", "Project Manager"]],
  hr: ["HR & Administration", "HRA", ["HR Officer", "Admin Assistant"]],
  finance: ["Finance", "FIN", ["Accountant", "Payroll Specialist"]],
};
// Each project has its own head office (ADR 0010).
const OFFICE_BY_PROJECT = { ksp: "riyadh", jwt: "jeddah" };
const PROJECTS = [
  ["ksp", "King Salman Park - Phase 2", "PRJ-FY26-0001", "Riyadh", "Al Malaz, Riyadh", 24.6877, 46.7219, "2025-03-01", "2027-06-30"],
  ["jwt", "Jeddah Waterfront Towers", "PRJ-FY26-0002", "Jeddah", "Corniche Road, Jeddah", 21.5433, 39.1728, "2026-01-15", "2028-12-31"],
];
const SHIFTS = [
  ["general", "GENERAL", "08:00:00", "17:00:00"],
  ["night", "NIGHT", "20:00:00", "05:00:00"],
];
// Saudi public holidays 2026. Islamic dates are estimates and move with moon sighting.
const HOLIDAYS = [
  ["2026-02-22", "Founding Day", "NATIONAL"],
  ["2026-03-19", "Eid al-Fitr", "FESTIVAL"],
  ["2026-03-20", "Eid al-Fitr", "FESTIVAL"],
  ["2026-03-21", "Eid al-Fitr", "FESTIVAL"],
  ["2026-03-22", "Eid al-Fitr", "FESTIVAL"],
  ["2026-05-26", "Arafat Day", "FESTIVAL"],
  ["2026-05-27", "Eid al-Adha", "FESTIVAL"],
  ["2026-09-23", "Saudi National Day", "NATIONAL"],
];

// Every Friday of 2026 is a weekly off for both shifts.
const fridays2026 = () => {
  const days = [];
  const d = new Date(Date.UTC(2026, 0, 2)); // 2 Jan 2026 is a Friday
  while (d.getUTCFullYear() === 2026) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return days;
};

const designationRows = () =>
  Object.entries(DEPARTMENTS).flatMap(([deptKey, [, , designations]]) =>
    designations.map((name) => ({
      id: seedId(`designation:${name}`),
      employer_id: EMPLOYER,
      department_id: seedId(`department:${deptKey}`),
      name,
      status: "ACTIVE",
    }))
  );

const weekOffRows = () =>
  SHIFTS.flatMap(([key]) =>
    fridays2026().map((off_date) => ({
      id: seedId(`weekoff:${key}:${off_date}`),
      shift_id: seedId(`shift:${key}`),
      employer_id: EMPLOYER,
      off_date,
    }))
  );

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      "hrms_departments",
      Object.entries(DEPARTMENTS).map(([key, [name, code]]) => ({
        id: seedId(`department:${key}`),
        employer_id: EMPLOYER,
        name,
        code,
        status: "ACTIVE",
      }))
    );
    await queryInterface.bulkInsert("hrms_designations", designationRows());
    await queryInterface.bulkInsert("offices", [
      {
        id: seedId("office:riyadh"),
        employer_id: EMPLOYER,
        office_name: "Riyadh Head Office",
        office_email: "riyadh@alnoor.test",
        office_phone: "+966112345678",
        phone_country: "SA",
        office_location: "King Fahd Road, Al Olaya, Riyadh",
        country_id: seedId("country:SA"),
        city_id: seedId("city:Riyadh"),
        lat: 24.7136,
        lng: 46.6753,
      },
      {
        id: seedId("office:jeddah"),
        employer_id: EMPLOYER,
        office_name: "Jeddah Head Office",
        office_email: "jeddah@alnoor.test",
        office_phone: "+966122345678",
        phone_country: "SA",
        office_location: "Prince Sultan Road, Al Rawdah, Jeddah",
        country_id: seedId("country:SA"),
        city_id: seedId("city:Jeddah"),
        lat: 21.5627,
        lng: 39.1531,
      },
    ]);
    await queryInterface.bulkInsert(
      "projects",
      PROJECTS.map(([key, project_name, project_code, city, project_location, lat, lng, start_date, end_date]) => ({
        id: seedId(`project:${key}`),
        employer_id: EMPLOYER,
        office_id: seedId(`office:${OFFICE_BY_PROJECT[key]}`),
        country_id: seedId("country:SA"),
        city_id: seedId(`city:${city}`),
        project_name,
        project_code,
        project_location,
        lat,
        lng,
        radius_meters: 250,
        start_date,
        end_date,
        status: "ACTIVE",
      }))
    );
    // The seeded codes PRJ-FY26-0001/0002 are taken: the next project of FY 2026 gets 0003.
    await queryInterface.bulkInsert("hrms_number_sequences", [
      { id: seedId("sequence:PROJECT:2026"), employer_id: EMPLOYER, doc_type: "PROJECT", financial_year_id: seedId("fy:2026"), last_no: PROJECTS.length },
    ]);
    await queryInterface.bulkInsert(
      "company_shifts",
      SHIFTS.map(([key, name, start_time, end_time]) => ({
        id: seedId(`shift:${key}`),
        employer_id: EMPLOYER,
        name,
        start_time,
        end_time,
      }))
    );
    await queryInterface.bulkInsert(
      "hrms_shift_time_history",
      SHIFTS.map(([key, , start_time, end_time]) => ({
        id: seedId(`shift-time:${key}`),
        shift_id: seedId(`shift:${key}`),
        employer_id: EMPLOYER,
        start_time,
        end_time,
        effective_from: "2026-01-01",
      }))
    );
    await queryInterface.bulkInsert("shift_week_offs", weekOffRows());
    await queryInterface.bulkInsert(
      "hrms_holidays",
      HOLIDAYS.map(([holiday_date, holiday_name, holiday_type]) => ({
        id: seedId(`holiday:${holiday_date}`),
        employer_id: EMPLOYER,
        holiday_name,
        holiday_date,
        holiday_type,
        is_global: true,
        is_active: true,
      }))
    );
  },

  async down(queryInterface) {
    await deleteIds(queryInterface, [
      ["hrms_holidays", HOLIDAYS.map(([date]) => seedId(`holiday:${date}`))],
      ["shift_week_offs", weekOffRows().map((row) => row.id)],
      ["hrms_shift_time_history", SHIFTS.map(([key]) => seedId(`shift-time:${key}`))],
      ["company_shifts", SHIFTS.map(([key]) => seedId(`shift:${key}`))],
      ["projects", PROJECTS.map(([key]) => seedId(`project:${key}`))],
      ["hrms_number_sequences", [seedId("sequence:PROJECT:2026")]],
      ["offices", [seedId("office:riyadh"), seedId("office:jeddah")]],
      ["hrms_designations", designationRows().map((row) => row.id)],
      ["hrms_departments", Object.keys(DEPARTMENTS).map((key) => seedId(`department:${key}`))],
    ]);
  },
};
