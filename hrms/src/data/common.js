// Shared static entities for the UI-only build. Feature data files build on
// these so the same people, departments and projects appear on every screen.

export const OFFICES = [
  { id: 1, name: "Dubai Head Office", office_type: "HEAD_OFFICE", address: "Business Bay, Dubai", city: "Dubai", country: "United Arab Emirates", latitude: 25.1857, longitude: 55.2723, radius: 200, status: "ACTIVE" },
  { id: 2, name: "Abu Dhabi Branch", office_type: "BRANCH", address: "Al Reem Island, Abu Dhabi", city: "Abu Dhabi", country: "United Arab Emirates", latitude: 24.4999, longitude: 54.4066, radius: 150, status: "ACTIVE" },
  { id: 3, name: "Riyadh Site Office", office_type: "SITE", address: "King Fahd Rd, Riyadh", city: "Riyadh", country: "Saudi Arabia", latitude: 24.7136, longitude: 46.6753, radius: 300, status: "ACTIVE" },
];

export const DEPARTMENTS = [
  { id: 1, name: "Engineering", code: "ENG", description: "Product and platform engineering", head_id: 3, employee_count: 14, designation_count: 4, status: "ACTIVE" },
  { id: 2, name: "Human Resources", code: "HR", description: "People operations and payroll", head_id: 2, employee_count: 5, designation_count: 3, status: "ACTIVE" },
  { id: 3, name: "Finance", code: "FIN", description: "Accounts, billing and treasury", head_id: 5, employee_count: 6, designation_count: 3, status: "ACTIVE" },
  { id: 4, name: "Operations", code: "OPS", description: "Site operations and logistics", head_id: 7, employee_count: 22, designation_count: 5, status: "ACTIVE" },
  { id: 5, name: "Sales", code: "SAL", description: "Business development", head_id: 8, employee_count: 8, designation_count: 2, status: "ACTIVE" },
];

export const DESIGNATIONS = [
  { id: 1, name: "Software Engineer", department_id: 1, level: "MID", employee_count: 8 },
  { id: 2, name: "Engineering Manager", department_id: 1, level: "SENIOR", employee_count: 1 },
  { id: 3, name: "HR Executive", department_id: 2, level: "MID", employee_count: 3 },
  { id: 4, name: "HR Manager", department_id: 2, level: "SENIOR", employee_count: 1 },
  { id: 5, name: "Accountant", department_id: 3, level: "MID", employee_count: 4 },
  { id: 6, name: "Site Supervisor", department_id: 4, level: "MID", employee_count: 6 },
  { id: 7, name: "Technician", department_id: 4, level: "JUNIOR", employee_count: 14 },
  { id: 8, name: "Sales Executive", department_id: 5, level: "MID", employee_count: 6 },
];

export const PROJECTS = [
  { id: 1, name: "Marina Tower Fit-out", code: "PRJ-001", client_name: "Emaar Properties", location: "Dubai Marina", office_id: 1, start_date: "2026-01-15", end_date: "2026-12-20", status: "ACTIVE", employee_count: 18 },
  { id: 2, name: "Yas Mall Expansion", code: "PRJ-002", client_name: "Aldar", location: "Yas Island, Abu Dhabi", office_id: 2, start_date: "2026-03-01", end_date: "2027-02-28", status: "ACTIVE", employee_count: 12 },
  { id: 3, name: "Riyadh Metro Maintenance", code: "PRJ-003", client_name: "RCRC", location: "Riyadh", office_id: 3, start_date: "2025-06-01", end_date: "2026-11-30", status: "ACTIVE", employee_count: 9 },
  { id: 4, name: "Internal Systems", code: "PRJ-004", client_name: "Internal", location: "Business Bay", office_id: 1, start_date: "2025-01-01", end_date: null, status: "ON_HOLD", employee_count: 4 },
];

const person = (id, first_name, last_name, employee_code, department_id, designation_id, extra = {}) => {
  const department = DEPARTMENTS.find((d) => d.id === department_id);
  const designation = DESIGNATIONS.find((d) => d.id === designation_id);
  return {
    id,
    employee_code,
    first_name,
    last_name,
    full_name: `${first_name} ${last_name}`,
    name: `${first_name} ${last_name}`,
    email: `${first_name}.${last_name}`.toLowerCase().replace(/\s+/g, "") + "@fyinder.com",
    phone: `+971 50 ${String(1000000 + id * 37311).slice(0, 3)} ${String(1000 + id * 113).slice(0, 4)}`,
    gender: "MALE",
    nationality: "United Arab Emirates",
    date_of_birth: "1990-04-12",
    date_of_joining: "2024-02-01",
    employment_type: "FULL_TIME",
    access_level: "EMPLOYEE",
    status: "ACTIVE",
    profile_image: null,
    department_id,
    designation_id,
    office_id: 1,
    department,
    designation,
    department_name: department?.name,
    designation_name: designation?.name,
    office: OFFICES[0],
    basic_salary: 8000,
    gross_salary: 12000,
    currency: "AED",
    ...extra,
  };
};

export const EMPLOYEES = [
  person(1, "Omar", "Haddad", "EMP-0001", 1, 2, { gender: "MALE", nationality: "Jordan", basic_salary: 22000, gross_salary: 31000, access_level: "ADMIN", date_of_joining: "2022-05-10" }),
  person(2, "Fatima", "Al Zahra", "EMP-0002", 2, 4, { gender: "FEMALE", basic_salary: 18000, gross_salary: 25000, access_level: "ADMIN", date_of_joining: "2022-08-01" }),
  person(3, "Rahul", "Menon", "EMP-0003", 1, 1, { nationality: "India", basic_salary: 12000, gross_salary: 17500, date_of_joining: "2023-01-16" }),
  person(4, "Sara", "Khan", "EMP-0004", 2, 3, { gender: "FEMALE", nationality: "Pakistan", basic_salary: 9000, gross_salary: 13000, date_of_joining: "2023-06-01" }),
  person(5, "Youssef", "Nasser", "EMP-0005", 3, 5, { nationality: "Egypt", basic_salary: 10000, gross_salary: 14500, date_of_joining: "2023-03-20" }),
  person(6, "Maria", "Santos", "EMP-0006", 1, 1, { gender: "FEMALE", nationality: "Philippines", basic_salary: 11000, gross_salary: 16000, date_of_joining: "2024-01-08" }),
  person(7, "Khalid", "Al Otaibi", "EMP-0007", 4, 6, { nationality: "Saudi Arabia", basic_salary: 9500, gross_salary: 14000, office_id: 3, office: OFFICES[2], date_of_joining: "2023-09-11" }),
  person(8, "Ayesha", "Siddiqui", "EMP-0008", 5, 8, { gender: "FEMALE", nationality: "India", basic_salary: 8500, gross_salary: 12500, date_of_joining: "2024-04-15" }),
  person(9, "Imran", "Sheikh", "EMP-0009", 4, 7, { nationality: "Pakistan", basic_salary: 3500, gross_salary: 5200, employment_type: "CONTRACT", office_id: 2, office: OFFICES[1], date_of_joining: "2025-02-03" }),
  person(10, "Joseph", "Mathew", "EMP-0010", 4, 7, { nationality: "India", basic_salary: 3200, gross_salary: 4800, employment_type: "CONTRACT", date_of_joining: "2025-03-17" }),
  person(11, "Layla", "Hassan", "EMP-0011", 3, 5, { gender: "FEMALE", nationality: "Lebanon", basic_salary: 10500, gross_salary: 15000, status: "INACTIVE", date_of_joining: "2023-11-01" }),
  person(12, "Bilal", "Ahmed", "EMP-0012", 4, 6, { nationality: "Bangladesh", basic_salary: 6000, gross_salary: 8800, date_of_joining: "2024-07-22" }),
];

export const employeeById = (id) => EMPLOYEES.find((e) => e.id === Number(id)) || EMPLOYEES[0];

export const COUNTRIES = [
  { id: 1, name: "United Arab Emirates", iso2: "AE", phone_code: "+971" },
  { id: 2, name: "Saudi Arabia", iso2: "SA", phone_code: "+966" },
  { id: 3, name: "Qatar", iso2: "QA", phone_code: "+974" },
  { id: 4, name: "India", iso2: "IN", phone_code: "+91" },
  { id: 5, name: "Pakistan", iso2: "PK", phone_code: "+92" },
  { id: 6, name: "Philippines", iso2: "PH", phone_code: "+63" },
  { id: 7, name: "Egypt", iso2: "EG", phone_code: "+20" },
];

export const CITIES = [
  { id: 1, name: "Dubai", country_id: 1 },
  { id: 2, name: "Abu Dhabi", country_id: 1 },
  { id: 3, name: "Sharjah", country_id: 1 },
  { id: 4, name: "Riyadh", country_id: 2 },
  { id: 5, name: "Jeddah", country_id: 2 },
  { id: 6, name: "Doha", country_id: 3 },
];

// Simple client-side list helpers for screens that used server paging/search.
export const paginate = (rows, page = 1, limit = 10) => ({
  rows: rows.slice((page - 1) * limit, page * limit),
  total: rows.length,
  totalPages: Math.max(1, Math.ceil(rows.length / limit)),
  page,
  limit,
});

export const matches = (row, search, keys) => {
  if (!search) return true;
  const q = String(search).toLowerCase();
  return keys.some((k) => String(row?.[k] ?? "").toLowerCase().includes(q));
};

export const nextId = (rows) => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
