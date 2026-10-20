const h = require("./helpers/contracts");
const { resolveMergeValues, valuesSha256 } = require("../src/services/contractMerge.service");
const { MERGE_FIELDS } = require("../src/constants/contractMergeFields");

const { db, createCompany, createEmployee, createStaffingCompany, createProject, assignProject } = h;

// Merge values (ticket contract-studio#22; plan decisions 20, 32, 44; ADR 0006, 0008).

afterAll(() => db.sequelize.close());

let n = 0;
const fieldsOf = (source, tokens, extra = {}) =>
  tokens.map((token) => ({ id: `f-${String((n += 1)).padStart(4, "0")}`, field_type: "DB_COLUMN", db_source: source, db_column: token, label: token, is_required: true, ...extra }));
const valuesByToken = (fields, values) => Object.fromEntries(fields.map((f) => [f.db_column, values.get(f.id)]));

describe("employee values", () => {
  let company;
  let employee;
  let user;
  let staffing;

  beforeAll(async () => {
    company = await createCompany("Al Noor Construction");
    const { employer } = company;
    const dept = await db.Department.create({ employer_id: employer.id, name: "Engineering", code: `D${h.short()}` });
    const desig = await db.Designation.create({ employer_id: employer.id, department_id: dept.id, name: "Site Engineer" });
    const shift = await db.CompanyShift.create({ employer_id: employer.id, name: "General", start_time: "08:00:00", end_time: "17:00:00" });
    ({ company: staffing } = await createStaffingCompany(employer, { name: "Gulf Manpower" }));
    ({ employee, user } = await createEmployee(employer, {
      full_name: "سارة خان",
      country_emp_id: "2400000001",
      department_id: dept.id,
      designation_id: desig.id,
      shift_id: shift.id,
      staffing_company_id: staffing.id,
      date_of_joining: "2023-01-16",
      employment_type: "FULL_TIME",
      nationality: "Pakistani",
      gender: "FEMALE",
      dob: "1990-04-12",
      address: "Al Olaya, Riyadh",
    }));
    await user.update({ phone_number: "+966501234567" });
    const project = await createProject(employer, { project_name: "King Salman Park" });
    await assignProject(employer, employee, project, { main_project: true, main_project_date_start: "2026-01-01" });
  });

  it("returns every Employee-group token from its source, formatted", async () => {
    const fields = fieldsOf("EMPLOYEE", MERGE_FIELDS.EMPLOYEE.map((f) => f.token));
    const { values, missing } = await resolveMergeValues({ employerId: company.employer.id, audience: "EMPLOYEE", recipientId: employee.id, contract: {}, fields });
    expect(valuesByToken(fields, values)).toEqual({
      employee_name: "سارة خان",
      employee_email: user.email,
      employee_phone: "+966501234567",
      employee_code: "2400000001",
      designation: "Site Engineer",
      department: "Engineering",
      project: "King Salman Park",
      staffing_company: "Gulf Manpower",
      joining_date: "16 Jan 2023",
      employment_type: "Full Time",
      nationality: "Pakistani",
      gender: "Female",
      dob: "12 Apr 1990",
      address: "Al Olaya, Riyadh",
      shift: "General",
      company_name: "Al Noor Construction",
    });
    expect(missing).toEqual([]);
  });

  it("formats IN_NOTICE-style enums with each word capitalised", async () => {
    await employee.update({ employment_type: "CONTRACT" });
    const fields = fieldsOf("EMPLOYEE", ["employment_type"]);
    const { values } = await resolveMergeValues({ employerId: company.employer.id, audience: "EMPLOYEE", recipientId: employee.id, contract: {}, fields });
    expect(values.get(fields[0].id)).toBe("Contract");
    await employee.update({ employment_type: "FULL_TIME" });
  });

  it("leaves staffing_company blank for a company-payroll employee", async () => {
    const { employee: own } = await createEmployee(company.employer, { full_name: "Own Payroll" });
    const fields = fieldsOf("EMPLOYEE", ["staffing_company"], { is_required: false });
    const { values, missing } = await resolveMergeValues({ employerId: company.employer.id, audience: "EMPLOYEE", recipientId: own.id, contract: {}, fields });
    expect(values.get(fields[0].id)).toBeNull();
    expect(missing).toEqual([]);
  });

  it("uses the main project with the latest start, then the latest created; none → missing", async () => {
    const { employee: e } = await createEmployee(company.employer);
    const a = await createProject(company.employer, { project_name: "Project A" });
    const b = await createProject(company.employer, { project_name: "Project B" });
    const fields = fieldsOf("EMPLOYEE", ["project"], { label: "Project" });
    const resolve = () => resolveMergeValues({ employerId: company.employer.id, audience: "EMPLOYEE", recipientId: e.id, contract: {}, fields });
    expect((await resolve()).missing).toEqual(["Project"]);
    await assignProject(company.employer, e, a, { main_project: true, main_project_date_start: "2026-01-01" });
    await assignProject(company.employer, e, b, { main_project: true, main_project_date_start: "2026-03-01" });
    expect((await resolve()).values.get(fields[0].id)).toBe("Project B");
  });

  it("reports empty required values as missing, with the field's label; optional ones aren't", async () => {
    const { employee: bare } = await createEmployee(company.employer, { full_name: "Bare" });
    const fields = [
      ...fieldsOf("EMPLOYEE", ["designation"], { label: "Designation" }),
      ...fieldsOf("EMPLOYEE", ["department"], { label: "Department", is_required: false }),
    ];
    const { values, missing } = await resolveMergeValues({ employerId: company.employer.id, audience: "EMPLOYEE", recipientId: bare.id, contract: {}, fields });
    expect([...values.values()]).toEqual([null, null]);
    expect(missing).toEqual(["Designation"]);
  });

  it("changes no employee, account or staffing-company row", async () => {
    const before = await db.Employee.findByPk(employee.id, { raw: true });
    await resolveMergeValues({
      employerId: company.employer.id,
      audience: "EMPLOYEE",
      recipientId: employee.id,
      contract: {},
      fields: fieldsOf("EMPLOYEE", MERGE_FIELDS.EMPLOYEE.map((f) => f.token)),
    });
    expect(await db.Employee.findByPk(employee.id, { raw: true })).toEqual(before);
  });
});

describe("staffing company values", () => {
  it("returns every Staffing Company-group token from its source", async () => {
    const company = await createCompany("Al Noor Construction");
    const { company: s } = await createStaffingCompany(company.employer, {
      name: "Gulf Manpower",
      code: "GULF",
      email: "ops@gulf.test",
      phone: "+966112223333",
      contact_person_name: "Rashid",
      contact_person_email: "rashid@gulf.test",
      contact_person_phone: "+966551112222",
      city: "Riyadh",
      address: "Industrial Area",
    });
    const fields = fieldsOf("STAFFING_COMPANY", MERGE_FIELDS.STAFFING_COMPANY.map((f) => f.token));
    const { values } = await resolveMergeValues({ employerId: company.employer.id, audience: "STAFFING_COMPANY", recipientId: s.id, contract: {}, fields });
    expect(valuesByToken(fields, values)).toEqual({
      company_name: "Gulf Manpower",
      company_code: "GULF",
      company_email: "ops@gulf.test",
      company_phone: "+966112223333",
      contact_person_name: "Rashid",
      contact_person_email: "rashid@gulf.test",
      contact_person_phone: "+966551112222",
      city: "Riyadh",
      address: "Industrial Area",
      employer_name: "Al Noor Construction",
    });
  });
});

describe("contract values", () => {
  let company;
  let type;
  beforeAll(async () => {
    company = await createCompany();
    type = await db.ContractType.create({ employer_id: company.employer.id, name: "Employment Contract", code: "EMP" });
  });
  const contract = (overrides = {}) => ({
    reference_no: "CON-2026-0001",
    contract_type_id: type.id,
    start_date: "2026-11-01",
    end_date: "2027-10-31",
    rate: "4500.00",
    rate_unit: "MONTHLY",
    currency: "SAR",
    notice_period_days: 30,
    sent_at: new Date("2026-10-20T22:30:00Z"), // 21 Oct in Riyadh (UTC+3)
    ...overrides,
  });
  const resolve = async (c, tokens) => {
    const fields = fieldsOf("CONTRACT", tokens, { is_required: false });
    const { values } = await resolveMergeValues({ employerId: company.employer.id, audience: "EMPLOYEE", recipientId: null, contract: c, fields });
    return valuesByToken(fields, values);
  };

  it("returns name, type, dates, rate, notice period, number and sent date from the contract", async () => {
    expect(await resolve(contract(), MERGE_FIELDS.CONTRACT.map((f) => f.token))).toEqual({
      contract_no: "CON-2026-0001",
      contract_type: "Employment Contract",
      start_date: "01 Nov 2026",
      end_date: "31 Oct 2027",
      rate: "SAR 4,500.00 / month",
      notice_period: "30 days",
      sent_date: "21 Oct 2026",
    });
  });

  it.each([
    ["HOURLY", "SAR 120.50 / hour", "120.50"],
    ["DAILY", "SAR 900.00 / day", "900"],
    ["ANNUAL", "SAR 54,000.00 / year", "54000"],
  ])("formats a %s rate", async (unit, expected, rate) => {
    expect((await resolve(contract({ rate, rate_unit: unit }), ["rate"])).rate).toBe(expected);
  });

  it.each([
    [1, "1 day"],
    [0, "0 days"],
    [30, "30 days"],
  ])("formats a notice period of %i", async (days, expected) => {
    expect((await resolve(contract({ notice_period_days: days }), ["notice_period"])).notice_period).toBe(expected);
  });

  it("leaves number and sent date blank before send", async () => {
    expect(await resolve(contract({ reference_no: null, sent_at: null }), ["contract_no", "sent_date"])).toEqual({ contract_no: null, sent_date: null });
  });
});

describe("values hash", () => {
  it("is the same whatever the order of the values", () => {
    const a = [
      { id: "b", field_type: "INPUT", value: "x" },
      { id: "a", field_type: "DB_COLUMN", value: "Sara" },
    ];
    expect(valuesSha256(a)).toBe(valuesSha256([...a].reverse()));
  });

  it("follows the recipe: SHA-256 of the sorted [id, type, value] JSON", () => {
    const crypto = require("crypto");
    const rows = [
      { id: "2", field_type: "SIGNATURE", value: "f".repeat(64) },
      { id: "1", field_type: "INPUT", value: "" },
    ];
    const expected = crypto.createHash("sha256").update(JSON.stringify([["1", "INPUT", null], ["2", "SIGNATURE", "f".repeat(64)]])).digest("hex");
    expect(valuesSha256(rows)).toBe(expected);
  });

  it("changes when any value changes", () => {
    expect(valuesSha256([{ id: "1", field_type: "INPUT", value: "a" }])).not.toBe(valuesSha256([{ id: "1", field_type: "INPUT", value: "b" }]));
  });
});
