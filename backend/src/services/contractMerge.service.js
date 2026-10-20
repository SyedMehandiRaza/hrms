const crypto = require("crypto");
const { Employee, User, Employer, Department, Designation, CompanyShift, StaffingCompany, ContractType } = require("../models");
const { findMergeField } = require("../constants/contractMergeFields");
const { mainProjects } = require("./contractParties.service");
const { companyTimezone, dateIn, formatDate } = require("../utils/companyTime");

// Merge values (plan decision 44, ADR 0006): one resolver used live by draft previews and
// frozen at send. Values are English-formatted text; free text is used as stored; empty →
// missing. Read-only toward employee and staffing data (ADR 0008).

const RATE_UNITS = { HOURLY: "hour", DAILY: "day", MONTHLY: "month", ANNUAL: "year" };

const blank = (v) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v));

// FULL_TIME → "Full Time", IN_NOTICE → "In Notice".
const enumLabel = (v) =>
  blank(v) &&
  String(v)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// 4500, "MONTHLY", "SAR" → "SAR 4,500.00 / month".
const formatRate = (rate, unit, currency) => {
  if (rate === null || rate === undefined || rate === "") return null;
  const amount = Number(rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency || "SAR"} ${amount}${unit ? ` / ${RATE_UNITS[unit]}` : ""}`;
};

const formatNoticePeriod = (days) => (days === null || days === undefined ? null : `${days} ${Number(days) === 1 ? "day" : "days"}`);

const loadEmployee = async (employerId, id, transaction) => {
  const employee = await Employee.findOne({
    where: { id, employer_id: employerId },
    paranoid: false,
    include: [
      { model: User, as: "user", attributes: ["email", "phone_number"] },
      { model: Department, as: "department", attributes: ["name"], paranoid: false },
      { model: Designation, as: "designation", attributes: ["name"], paranoid: false },
      { model: CompanyShift, as: "shift", attributes: ["name"], paranoid: false },
      { model: StaffingCompany, as: "staffingCompany", attributes: ["name"], paranoid: false },
    ],
    transaction,
  });
  if (!employee) return null;
  const project = (await mainProjects(employerId, [employee.id], transaction)).get(employee.id) || null;
  return { employee, project };
};

const loadStaffing = (employerId, id, transaction) =>
  StaffingCompany.findOne({ where: { id, employer_id: employerId }, paranoid: false, transaction });

const employeeValue = (token, { employee, project }, employer) => {
  const e = employee;
  switch (token) {
    case "employee_name":
      return e.full_name;
    case "employee_email":
      return e.user?.email;
    case "employee_phone":
      return e.user?.phone_number;
    case "employee_code":
      return e.country_emp_id;
    case "designation":
      return e.designation?.name;
    case "department":
      return e.department?.name;
    case "project":
      return project?.project_name;
    case "staffing_company":
      return e.staffingCompany?.name;
    case "joining_date":
      return formatDate(e.date_of_joining);
    case "employment_type":
      return enumLabel(e.employment_type);
    case "nationality":
      return e.nationality;
    case "gender":
      return enumLabel(e.gender);
    case "dob":
      return formatDate(e.dob);
    case "address":
      return e.address;
    case "shift":
      return e.shift?.name;
    case "company_name":
      return employer.company_name;
    default:
      return null;
  }
};

const staffingValue = (token, s, employer) => {
  switch (token) {
    case "company_name":
      return s.name;
    case "company_code":
      return s.code;
    case "company_email":
      return s.email;
    case "company_phone":
      return s.phone;
    case "contact_person_name":
      return s.contact_person_name;
    case "contact_person_email":
      return s.contact_person_email;
    case "contact_person_phone":
      return s.contact_person_phone;
    case "city":
      return s.city;
    case "address":
      return s.address;
    case "employer_name":
      return employer.company_name;
    default:
      return null;
  }
};

// contract: { reference_no, contract_type_id, start_date, end_date, rate, rate_unit, currency,
// notice_period_days, sent_at }
const contractValue = (token, contract, { typeName, tz }) => {
  switch (token) {
    case "contract_no":
      return contract.reference_no;
    case "contract_type":
      return typeName;
    case "start_date":
      return formatDate(contract.start_date);
    case "end_date":
      return formatDate(contract.end_date);
    case "rate":
      return formatRate(contract.rate, contract.rate_unit, contract.currency);
    case "notice_period":
      return formatNoticePeriod(contract.notice_period_days);
    case "sent_date":
      return contract.sent_at ? formatDate(dateIn(tz, new Date(contract.sent_at))) : null;
    default:
      return null;
  }
};

// Resolves every DB_COLUMN field of a contract for its recipient.
//   fields: [{ id, field_type, db_source, db_column, label, is_required }]
// → { values: Map(fieldId → text|null), missing: [labels of REQUIRED fields without a value] }
const resolveMergeValues = async ({ employerId, audience, recipientId, contract, fields, transaction }) => {
  const mergeFields = fields.filter((f) => f.field_type === "DB_COLUMN");
  const values = new Map();
  if (!mergeFields.length) return { values, missing: [] };

  const [employer, tz, type] = await Promise.all([
    Employer.findByPk(employerId, { attributes: ["company_name"], transaction }),
    companyTimezone(employerId, transaction),
    contract.contract_type_id ? ContractType.findByPk(contract.contract_type_id, { attributes: ["name"], transaction }) : null,
  ]);
  const needs = new Set(mergeFields.map((f) => f.db_source));
  const person = needs.has("EMPLOYEE") && audience === "EMPLOYEE" ? await loadEmployee(employerId, recipientId, transaction) : null;
  const staffing = needs.has("STAFFING_COMPANY") && audience === "STAFFING_COMPANY" ? await loadStaffing(employerId, recipientId, transaction) : null;

  const missing = [];
  for (const f of mergeFields) {
    let value = null;
    if (findMergeField(audience, f.db_source, f.db_column)) {
      if (f.db_source === "EMPLOYEE" && person) value = employeeValue(f.db_column, person, employer);
      else if (f.db_source === "STAFFING_COMPANY" && staffing) value = staffingValue(f.db_column, staffing, employer);
      else if (f.db_source === "CONTRACT") value = contractValue(f.db_column, contract, { typeName: type?.name, tz });
    }
    value = blank(value);
    values.set(f.id, value);
    if (value === null && f.is_required) missing.push(f.label || f.db_column);
  }
  return { values, missing };
};

// The values_sha256 recipe (decision 32): SHA-256 of the UTF-8 JSON array of
// [fieldId, fieldType, value] sorted by field id. `value` is the stored text; for a drawn
// signature it's the image's SHA-256. Empty values are null.
const valuesSha256 = (entries) => {
  const rows = entries
    .map(({ id, field_type: type, value }) => [id, type, value === undefined || value === "" ? null : value])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return crypto.createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex");
};

module.exports = { resolveMergeValues, valuesSha256, formatRate, formatNoticePeriod, enumLabel };
