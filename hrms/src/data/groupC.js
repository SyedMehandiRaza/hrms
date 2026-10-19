// Static data for group C screens: departments/designations, head offices,
// projects (incl. collaboration "assigned to me"), shifts, holidays and
// staffing companies. Built on the shared entities in common.js.

import { DEPARTMENTS, DESIGNATIONS, OFFICES, PROJECTS, EMPLOYEES, COUNTRIES, CITIES, nextId } from "./common";

// ── Employees (picker / roster shape) ─────────────────────────────────────────
// Adds the fields the pickers and rosters read: country_emp_id, User.email,
// roles[0].name, user_status, employment_status.
const EMPLOYMENT_STATUS = { 11: "EXITED" };

export const ASSIGNABLE_EMPLOYEES = EMPLOYEES.map((e) => ({
  ...e,
  country_emp_id: e.employee_code,
  User: { email: e.email },
  roles: [{ name: e.designation_name }],
  user_status: e.status,
  employment_status: EMPLOYMENT_STATUS[e.id] || "ACTIVE",
  profile_url: null,
}));

const empById = (id) => ASSIGNABLE_EMPLOYEES.find((e) => e.id === id);

// ── Countries / calling codes ─────────────────────────────────────────────────
export const CALLING_COUNTRIES = [
  ...COUNTRIES.map((c) => ({ id: c.id, name: c.name, calling_code: c.phone_code })),
  { id: 8, name: "Oman", calling_code: "+968" },
  { id: 9, name: "Kuwait", calling_code: "+965" },
  { id: 10, name: "Bahrain", calling_code: "+973" },
];

export const searchCallingCountries = (q = "") => {
  const s = String(q).trim().toLowerCase();
  return CALLING_COUNTRIES.filter(
    (c) => !s || c.name.toLowerCase().includes(s) || c.calling_code.includes(s),
  ).slice(0, 10);
};

// ── Cities (project / staffing city pickers) ──────────────────────────────────
export const PROJECT_CITIES = [
  ...CITIES.map((c) => ({ id: c.id, city_name: c.name, country_id: c.country_id })),
  { id: 7, city_name: "Al Ain", country_id: 1 },
  { id: 8, city_name: "Dammam", country_id: 2 },
];

export const searchCities = (q = "") => {
  const s = String(q).trim().toLowerCase();
  return PROJECT_CITIES.filter((c) => !s || c.city_name.toLowerCase().includes(s));
};

// ── Head offices ──────────────────────────────────────────────────────────────
const OFFICE_EXTRA = {
  1: { office_email: "hq@fyinder.com", office_phone: "+97142345678", members: [1, 2, 3], employee_count: 24, contract_count: 3 },
  2: { office_email: "abudhabi@fyinder.com", office_phone: "+97126543210", members: [9, 12], employee_count: 11, contract_count: 4 },
  3: { office_email: "riyadh@fyinder.com", office_phone: "+966112233445", members: [7], employee_count: 9, contract_count: 2 },
};

const officeProjects = (officeId) =>
  PROJECTS.filter((p) => p.office_id === officeId && p.status === "ACTIVE").map((p) => ({ id: p.id, project_name: p.name }));

export const HEAD_OFFICES = [
  ...OFFICES.map((o) => {
    const x = OFFICE_EXTRA[o.id];
    return {
      id: o.id,
      office_name: o.name,
      office_email: x.office_email,
      office_phone: x.office_phone,
      office_location: o.address,
      office_image: null,
      latitude: o.latitude,
      longitude: o.longitude,
      project: officeProjects(o.id),
      members_preview: x.members.map((id) => empById(id)?.full_name),
      employee_count: x.employee_count,
      contract_count: x.contract_count,
    };
  }),
  {
    id: 4,
    office_name: "Doha Liaison Office",
    office_email: "doha@fyinder.com",
    office_phone: "+97444556677",
    office_location: "West Bay, Doha",
    office_image: null,
    project: [],
    members_preview: [],
    employee_count: 0,
    contract_count: 0,
  },
];

// ── Projects ──────────────────────────────────────────────────────────────────
const PROJECT_EXTRA = {
  1: { city_id: 1, lat: 25.0805, lng: 55.1403, radius_meters: 250, contract_count: 5, allow_offline_attendance: true, description: "Interior fit-out of floors 12–30 including MEP works and joinery." },
  2: { city_id: 2, lat: 24.4889, lng: 54.6086, radius_meters: 400, contract_count: 4, allow_offline_attendance: true, description: "Retail expansion of the north wing with a new 1,200-bay car park." },
  3: { city_id: 4, lat: 24.7136, lng: 46.6753, radius_meters: 500, contract_count: 3, allow_offline_attendance: false, description: "Preventive maintenance of stations on Line 1 and Line 2." },
  4: { city_id: 1, lat: 25.1857, lng: 55.2723, radius_meters: 150, contract_count: 0, allow_offline_attendance: true, description: "" },
};

const toApiStatus = (s) => (s === "ON_HOLD" ? "INACTIVE" : s);

const projectFromBase = (p) => {
  const x = PROJECT_EXTRA[p.id];
  const office = HEAD_OFFICES.find((o) => o.id === p.office_id);
  const city = PROJECT_CITIES.find((c) => c.id === x.city_id);
  return {
    id: p.id,
    project_name: p.name,
    project_code: p.code,
    project_location: p.location,
    client_name: p.client_name,
    description: x.description,
    start_date: p.start_date,
    end_date: p.end_date,
    status: toApiStatus(p.status),
    office_id: p.office_id,
    office: office ? { id: office.id, office_name: office.office_name } : null,
    city_id: x.city_id,
    city: city || null,
    city_name: city?.city_name,
    lat: x.lat,
    lng: x.lng,
    radius_meters: x.radius_meters,
    allow_offline_attendance: x.allow_offline_attendance,
    photo_url: null,
    employee_count: p.employee_count,
    contract_count: x.contract_count,
  };
};

export const HRMS_PROJECTS = [
  ...PROJECTS.map(projectFromBase),
  {
    id: 5,
    project_name: "Jeddah Corniche Lighting",
    project_code: "PRJ-005",
    project_location: "Jeddah Corniche",
    client_name: "Jeddah Municipality",
    description: "Supply and installation of LED street lighting along the corniche.",
    start_date: "2025-02-01",
    end_date: "2025-12-15",
    status: "COMPLETED",
    office_id: 3,
    office: { id: 3, office_name: "Riyadh Site Office" },
    city_id: 5,
    city: PROJECT_CITIES.find((c) => c.id === 5),
    city_name: "Jeddah",
    lat: 21.5433,
    lng: 39.1728,
    radius_meters: 600,
    allow_offline_attendance: true,
    photo_url: null,
    employee_count: 7,
    contract_count: 6,
  },
];

export const projectById = (id) =>
  HRMS_PROJECTS.find((p) => String(p.id) === String(id)) || HRMS_PROJECTS[0];

// A just-created project (from the create form) shaped as a list row.
export const projectRowFrom = (created, existing = HRMS_PROJECTS) => ({
  employee_count: 0,
  contract_count: 0,
  ...created,
  id: nextId(existing),
});

export const projectDashboard = (list = HRMS_PROJECTS) => ({
  total_projects: list.length,
  active_projects: list.filter((p) => p.status === "ACTIVE").length,
  completed_projects: list.filter((p) => p.status === "COMPLETED").length,
  total_employees: 42,
  distribution: { full_time: 30, contract: 12 },
  attendance_today: { date: "2026-10-17", expected: 38, present: 31, absent: 3, on_leave: 4 },
});

export const WORKFORCE_SUMMARY = { total: 42, on_own_project: 29, deployed_out: 6, bench: 7 };

// Roster per project (ids from ASSIGNABLE_EMPLOYEES). Some rows come through a
// staffing company so that column shows both variants.
const PROJECT_ROSTER = {
  1: [3, 6, 9, 10, 12],
  2: [1, 4, 9, 11],
  3: [7, 12, 10],
  4: [1, 3],
  5: [7],
};
const VIA_AGENCY = { 9: "Gulf Manpower Services", 10: "Al Sahraa Recruitment" };

export const projectEmployeesFor = (projectId, isStaffingCompany = false) => {
  const ids = isStaffingCompany ? [9, 10] : PROJECT_ROSTER[projectId] || [];
  return ids.map((id) => {
    const e = empById(id);
    const agency = VIA_AGENCY[id] || null;
    return {
      ...e,
      role: e.designation_name,
      staffing_company: agency,
      staffingCompany: agency ? { name: agency } : null,
    };
  });
};

// ── Collaboration: host projects assigned to me ───────────────────────────────
export const ASSIGNED_TO_ME_PROJECTS = [
  { id: 101, project_name: "Dubai Creek Harbour Tower B", owner: "Emaar Properties", my_role: "CONSULTANT", status: "ACTIVE", start_date: "2026-01-05", location: "Dubai Creek Harbour, Dubai" },
  { id: 102, project_name: "Saadiyat Cultural District", owner: "Aldar Projects", my_role: "EPC", status: "ACTIVE", start_date: "2026-02-15", location: "Saadiyat Island, Abu Dhabi" },
  { id: 103, project_name: "Riyadh Metro Line 3 Depot", owner: "ArRiyadh New Mobility", my_role: "SUBCONTRACTOR", status: "INACTIVE", start_date: "2026-04-01", location: "Riyadh, KSA" },
  { id: 104, project_name: "Lusail Marina Promenade", owner: "Qatari Diar", my_role: "SUBCONTRACTOR", status: "COMPLETED", start_date: "2025-03-10", location: "Lusail, Qatar" },
];

const DEPLOYMENTS = { 101: [3, 6], 102: [7, 9, 12], 103: [], 104: [10] };

export const deploymentsFor = (projectId) => (DEPLOYMENTS[projectId] || []).map(empById);

// ── Departments & designations ────────────────────────────────────────────────
const deptHeadOf = (headId) => {
  const e = empById(headId);
  return e ? { id: e.id, full_name: e.full_name, profile_url: null } : null;
};

const CREATED = { 1: "2022-05-10", 2: "2022-05-10", 3: "2022-06-01", 4: "2023-01-15", 5: "2023-09-01" };

export const DEPARTMENT_ROWS = [
  ...DEPARTMENTS.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    description: d.description,
    status: d.status,
    deptHead: deptHeadOf(d.head_id),
    designation_count: d.designation_count,
    employee_count: d.employee_count,
    created_at: `${CREATED[d.id]}T08:00:00.000Z`,
  })),
  {
    id: 6,
    name: "Procurement",
    code: "PRC",
    description: "Vendor sourcing and purchase orders",
    status: "INACTIVE",
    deptHead: null,
    designation_count: 0,
    employee_count: 0,
    created_at: "2025-11-20T08:00:00.000Z",
  },
];

export const departmentDetailById = (id) =>
  DEPARTMENT_ROWS.find((d) => String(d.id) === String(id)) || DEPARTMENT_ROWS[0];

const DESIG_CODES = { 1: "SWE", 2: "EM", 3: "HRE", 4: "HRM", 5: "ACC", 6: "SSUP", 7: "TECH", 8: "SEX" };

export const DESIGNATION_ROWS = [
  ...DESIGNATIONS.map((d) => ({
    id: d.id,
    name: d.name,
    code: DESIG_CODES[d.id],
    description: `${d.name} (${d.level.toLowerCase()} level)`,
    status: "ACTIVE",
    department_id: d.department_id,
    employee_count: d.employee_count,
  })),
  { id: 9, name: "Senior Software Engineer", code: "SSWE", description: "Owns a product area end to end", status: "ACTIVE", department_id: 1, employee_count: 3 },
  { id: 10, name: "QA Engineer", code: "QA", description: "Manual and automated testing", status: "INACTIVE", department_id: 1, employee_count: 0 },
  { id: 11, name: "Payroll Officer", code: "PAY", description: "Monthly payroll and WPS files", status: "ACTIVE", department_id: 2, employee_count: 1 },
  { id: 12, name: "Finance Manager", code: "FM", description: "Leads accounts and treasury", status: "ACTIVE", department_id: 3, employee_count: 1 },
  { id: 13, name: "Logistics Coordinator", code: "LOG", description: "Transport and camp logistics", status: "INACTIVE", department_id: 4, employee_count: 0 },
];

// ── Holidays (UAE public holidays + company days) ─────────────────────────────
const holiday = (id, holiday_name, holiday_date, holiday_type, extra = {}) => ({
  id,
  holiday_name,
  holiday_date,
  holiday_type,
  description: null,
  is_global: true,
  is_optional: false,
  is_half_day: false,
  from_time: null,
  to_time: null,
  is_active: true,
  ...extra,
});

export const HOLIDAYS = [
  holiday(1, "New Year's Day", "2026-01-01", "PUBLIC"),
  holiday(2, "Eid al-Fitr", "2026-03-20", "FESTIVAL", { description: "End of Ramadan" }),
  holiday(3, "Eid al-Fitr Holiday", "2026-03-21", "FESTIVAL"),
  holiday(4, "Arafat Day", "2026-05-26", "FESTIVAL"),
  holiday(5, "Eid al-Adha", "2026-05-27", "FESTIVAL"),
  holiday(6, "Eid al-Adha Holiday", "2026-05-28", "FESTIVAL"),
  holiday(7, "Islamic New Year", "2026-06-16", "PUBLIC"),
  holiday(8, "Prophet's Birthday", "2026-08-25", "PUBLIC"),
  holiday(9, "Commemoration Day", "2026-12-01", "NATIONAL"),
  holiday(10, "UAE National Day", "2026-12-02", "NATIONAL", { description: "Eid Al Etihad" }),
  holiday(11, "UAE National Day Holiday", "2026-12-03", "NATIONAL"),
  holiday(12, "Company Foundation Day", "2026-10-29", "COMPANY", { description: "Fyinder anniversary — half day", is_half_day: true, from_time: "09:00:00", to_time: "13:00:00" }),
  holiday(13, "Diwali", "2026-11-08", "OPTIONAL", { is_optional: true, is_global: false }),
  holiday(14, "Christmas Day", "2026-12-25", "OPTIONAL", { is_optional: true, is_global: false }),
  holiday(15, "New Year's Day", "2025-01-01", "PUBLIC"),
  holiday(16, "Eid al-Fitr", "2025-03-30", "FESTIVAL"),
  holiday(17, "Eid al-Adha", "2025-06-06", "FESTIVAL"),
  holiday(18, "UAE National Day", "2025-12-02", "NATIONAL"),
];

// ── Shifts (in-memory store shared by the list and the add/edit form) ─────────
const pad = (n) => String(n).padStart(2, "0");

// Every date in 2025–2026 whose weekday (0 = Sun … 6 = Sat) is in `weekdays`.
const offDays = (weekdays) => {
  const out = [];
  for (let y = 2025; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const days = new Date(y, m, 0).getDate();
      for (let d = 1; d <= days; d++) {
        if (weekdays.includes(new Date(y, m - 1, d).getDay())) out.push(`${y}-${pad(m)}-${pad(d)}`);
      }
    }
  }
  return out;
};

let shiftStore = [
  {
    id: 1,
    name: "General Shift",
    start_time: "09:00:00",
    end_time: "18:00:00",
    timing_today: { start_time: "09:00:00", end_time: "18:00:00" },
    versions: [
      { effective_from: "2026-03-01", start_time: "09:00:00", end_time: "18:00:00" },
      { effective_from: "2000-01-01", start_time: "08:30:00", end_time: "17:30:00" },
    ],
    weekly_off_days: offDays([6, 0]),
  },
  {
    id: 2,
    name: "Night Shift",
    start_time: "22:00:00",
    end_time: "06:00:00",
    timing_today: { start_time: "22:00:00", end_time: "06:00:00" },
    versions: [{ effective_from: "2000-01-01", start_time: "22:00:00", end_time: "06:00:00" }],
    weekly_off_days: offDays([5]),
  },
  {
    id: 3,
    name: "Ramadan Shift",
    start_time: "09:00:00",
    end_time: "15:00:00",
    timing_today: { start_time: "09:00:00", end_time: "15:00:00" },
    versions: [{ effective_from: "2000-01-01", start_time: "09:00:00", end_time: "15:00:00" }],
    weekly_off_days: offDays([5, 6]),
  },
  {
    id: 4,
    name: "Site Morning Shift",
    start_time: "06:00:00",
    end_time: "14:00:00",
    timing_today: { start_time: "06:00:00", end_time: "14:00:00" },
    versions: [
      { effective_from: "2026-11-01", start_time: "06:30:00", end_time: "14:30:00" },
      { effective_from: "2000-01-01", start_time: "06:00:00", end_time: "14:00:00" },
    ],
    weekly_off_days: offDays([5]),
  },
];

export const getShifts = () => shiftStore;

export const getShiftById = (id) => shiftStore.find((s) => String(s.id) === String(id)) || shiftStore[0];

const withSeconds = (v) => (v && String(v).length === 5 ? `${v}:00` : v);

export const saveShift = (id, payload) => {
  const start_time = withSeconds(payload.start_time);
  const end_time = withSeconds(payload.end_time);
  if (id) {
    shiftStore = shiftStore.map((s) =>
      String(s.id) === String(id)
        ? { ...s, name: payload.name, start_time, end_time, timing_today: { start_time, end_time }, weekly_off_days: payload.weekly_off_days }
        : s,
    );
  } else {
    shiftStore = [
      ...shiftStore,
      {
        id: nextId(shiftStore),
        name: payload.name,
        start_time,
        end_time,
        timing_today: { start_time, end_time },
        versions: [{ effective_from: "2000-01-01", start_time, end_time }],
        weekly_off_days: payload.weekly_off_days,
      },
    ];
  }
};

export const deleteShiftById = (id) => {
  shiftStore = shiftStore.filter((s) => String(s.id) !== String(id));
};

// ── Staffing companies ────────────────────────────────────────────────────────
export const STAFFING_COMPANIES = [
  {
    id: 1,
    name: "Gulf Manpower Services",
    code: "GMS-001",
    email: "ops@gulfmanpower.ae",
    phone: "+971 4 335 1200",
    contact_person_name: "Rashid Al Hammadi",
    contact_person_email: "rashid@gulfmanpower.ae",
    contact_person_phone: "+971 50 412 8890",
    city: "Dubai",
    address: "Al Qusais Industrial Area 2",
    status: "ACTIVE",
    company_image: null,
    project_ids: [1, 2],
    total_employees: 4,
    summary: { total_employees: 4, active_employees: 3, inactive_employees: 1 },
  },
  {
    id: 2,
    name: "Al Sahraa Recruitment",
    code: "ASR-014",
    email: "info@alsahraa.sa",
    phone: "+966 11 465 7720",
    contact_person_name: "Faisal Al Qahtani",
    contact_person_email: "faisal@alsahraa.sa",
    contact_person_phone: "+966 55 310 4421",
    city: "Riyadh",
    address: "Olaya Street, Al Olaya",
    status: "ACTIVE",
    company_image: null,
    project_ids: [3, 5],
    total_employees: 3,
    summary: { total_employees: 3, active_employees: 3, inactive_employees: 0 },
  },
  {
    id: 3,
    name: "Emirates Workforce Solutions",
    code: "EWS-007",
    email: "hello@ewsolutions.ae",
    phone: "+971 2 644 9010",
    contact_person_name: "Priya Raman",
    contact_person_email: "priya@ewsolutions.ae",
    contact_person_phone: "+971 56 208 7712",
    city: "Abu Dhabi",
    address: "Mussafah M-37",
    status: "ACTIVE",
    company_image: null,
    project_ids: [2],
    total_employees: 2,
    summary: { total_employees: 2, active_employees: 2, inactive_employees: 0 },
  },
  {
    id: 4,
    name: "Desert Star Contracting",
    code: "DSC-022",
    email: "admin@desertstar.qa",
    phone: "+974 4431 5560",
    contact_person_name: "Tariq Mahmoud",
    contact_person_email: "tariq@desertstar.qa",
    contact_person_phone: "+974 5512 3344",
    city: "Doha",
    address: "Industrial Area Street 24",
    status: "INACTIVE",
    company_image: null,
    project_ids: [],
    total_employees: 0,
    summary: { total_employees: 0, active_employees: 0, inactive_employees: 0 },
  },
];

export const staffingCompanyById = (id) =>
  STAFFING_COMPANIES.find((c) => String(c.id) === String(id)) || STAFFING_COMPANIES[0];

// Agency-supplied workers (their own roster, not company employees).
const agencyWorker = (id, full_name, country_emp_id, role, employment_type, status, project) => ({
  id,
  full_name,
  country_emp_id,
  email: `${full_name.split(" ")[0].toLowerCase()}@agency.example`,
  profile_url: null,
  role,
  employment_type,
  status,
  project,
});

const AGENCY_EMPLOYEES = {
  1: [
    agencyWorker(201, "Imran Sheikh", "GMS-0101", "Technician", "CONTRACT", "ACTIVE", "Marina Tower Fit-out"),
    agencyWorker(202, "Ramesh Kumar", "GMS-0102", "Electrician", "CONTRACT", "ACTIVE", "Yas Mall Expansion"),
    agencyWorker(203, "Jun Dela Cruz", "GMS-0103", "Foreman", "FULL_TIME", "ACTIVE", "Marina Tower Fit-out"),
    agencyWorker(204, "Abdul Karim", "GMS-0104", "Helper", "CONTRACT", "INACTIVE", null),
  ],
  2: [
    agencyWorker(205, "Joseph Mathew", "ASR-0201", "Technician", "CONTRACT", "ACTIVE", "Riyadh Metro Maintenance"),
    agencyWorker(206, "Hassan Ali", "ASR-0202", "Site Supervisor", "FULL_TIME", "ACTIVE", "Jeddah Corniche Lighting"),
    agencyWorker(207, "Sunil Thapa", "ASR-0203", "Welder", "CONTRACT", "ACTIVE", "Riyadh Metro Maintenance"),
  ],
  3: [
    agencyWorker(208, "Mark Reyes", "EWS-0301", "Plumber", "CONTRACT", "ACTIVE", "Yas Mall Expansion"),
    agencyWorker(209, "Nadeem Akhtar", "EWS-0302", "Driver", "FULL_TIME", "ACTIVE", "Yas Mall Expansion"),
  ],
};

export const staffingEmployeesFor = (companyId) => AGENCY_EMPLOYEES[companyId] || [];

// ── Location picker (stands in for LocationIQ search / reverse geocoding) ────
export const STATIC_PLACES = [
  { place_id: "p1", display_name: "Business Bay, Dubai, United Arab Emirates", lat: "25.1857", lon: "55.2723" },
  { place_id: "p2", display_name: "Dubai Marina, Dubai, United Arab Emirates", lat: "25.0805", lon: "55.1403" },
  { place_id: "p3", display_name: "Dubai Creek Harbour, Dubai, United Arab Emirates", lat: "25.2003", lon: "55.3461" },
  { place_id: "p4", display_name: "Yas Island, Abu Dhabi, United Arab Emirates", lat: "24.4889", lon: "54.6086" },
  { place_id: "p5", display_name: "Al Reem Island, Abu Dhabi, United Arab Emirates", lat: "24.4999", lon: "54.4066" },
  { place_id: "p6", display_name: "Al Majaz, Sharjah, United Arab Emirates", lat: "25.3247", lon: "55.3863" },
  { place_id: "p7", display_name: "King Fahd Road, Riyadh, Saudi Arabia", lat: "24.7136", lon: "46.6753" },
  { place_id: "p8", display_name: "Jeddah Corniche, Jeddah, Saudi Arabia", lat: "21.5433", lon: "39.1728" },
  { place_id: "p9", display_name: "West Bay, Doha, Qatar", lat: "25.3226", lon: "51.5310" },
];

export const searchPlacesStatic = (q = "") => {
  const s = String(q).trim().toLowerCase();
  if (!s) return [];
  const hits = STATIC_PLACES.filter((p) => p.display_name.toLowerCase().includes(s));
  return hits.length ? hits : STATIC_PLACES.slice(0, 2);
};

export const reverseGeocodeStatic = ({ lat, lng }) => {
  let best = null;
  let bestD = Infinity;
  STATIC_PLACES.forEach((p) => {
    const d = (Number(p.lat) - lat) ** 2 + (Number(p.lon) - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  });
  return best ? best.display_name : "";
};
