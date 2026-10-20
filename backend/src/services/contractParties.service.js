const { Op } = require("sequelize");
const { Employee, StaffingCompany, HrmsAccount, EmployeeProject, Project } = require("../models");
const { CURRENT_ACCOUNT_STATUSES } = require("./auth.service");

// Read-only facts about contract recipients (ADR 0008): who is still active (plan
// decision 41) and an employee's main project (decision 20). Contract Studio never writes
// employees, accounts or staffing companies.

const AUDIENCES = Object.freeze({ EMPLOYEE: "EMPLOYEE", STAFFING_COMPANY: "STAFFING_COMPANY" });
const SUPPORTED_AUDIENCES = Object.values(AUDIENCES);

// user ids (of `userIds`) that have a current account (ACTIVE or SUSPENDED, not deleted)
// in the company, optionally of one access level.
const usersWithCurrentAccount = async (employerId, userIds, accessLevel, transaction) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const where = { employer_id: employerId, user_id: { [Op.in]: ids }, status: { [Op.in]: CURRENT_ACCOUNT_STATUSES } };
  if (accessLevel) where.access_level = accessLevel;
  const rows = await HrmsAccount.findAll({ where, attributes: ["user_id"], transaction });
  return new Set(rows.map((r) => r.user_id));
};

// Employee inactive: EXITED, soft-deleted, or no current account in this company.
// IN_NOTICE and SUSPENDED accounts are still active.
const employeesActive = async (employerId, employees, transaction) => {
  const current = await usersWithCurrentAccount(employerId, employees.map((e) => e.user_id), null, transaction);
  return new Map(
    employees.map((e) => [e.id, !e.deleted_at && !e.deletedAt && e.employment_status !== "EXITED" && current.has(e.user_id)])
  );
};

// Staffing company inactive: INACTIVE, soft-deleted, no login, or that login has no current
// STAFFING_COMPANY account in this company.
const staffingCompaniesActive = async (employerId, companies, transaction) => {
  const current = await usersWithCurrentAccount(employerId, companies.map((c) => c.user_id), "STAFFING_COMPANY", transaction);
  return new Map(
    companies.map((c) => [c.id, !c.deleted_at && !c.deletedAt && c.status === "ACTIVE" && Boolean(c.user_id) && current.has(c.user_id)])
  );
};

// Main project per employee id: the active assignment flagged main; with several, the
// latest main_project_date_start, then the latest created. None → absent from the map.
const mainProjects = async (employerId, employeeIds, transaction) => {
  if (!employeeIds.length) return new Map();
  const rows = await EmployeeProject.findAll({
    where: { employer_id: employerId, employee_id: { [Op.in]: employeeIds }, main_project: true, is_active: true },
    include: [{ model: Project, as: "project", attributes: ["id", "project_name"], paranoid: false }],
    order: [
      ["main_project_date_start", "DESC"],
      ["createdAt", "DESC"],
    ],
    transaction,
  });
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.employee_id) && row.project) map.set(row.employee_id, row.project);
  });
  return map;
};

// One recipient (any state, deleted included) of the company, or null.
const findEmployee = (employerId, id, options = {}) =>
  Employee.findOne({ where: { id, employer_id: employerId }, paranoid: false, ...options });
const findStaffingCompany = (employerId, id, options = {}) =>
  StaffingCompany.findOne({ where: { id, employer_id: employerId }, paranoid: false, ...options });

// Is this one recipient still active? audience EMPLOYEE | STAFFING_COMPANY.
const isRecipientActive = async (employerId, audience, recipientId, transaction) => {
  if (audience === AUDIENCES.EMPLOYEE) {
    const employee = await findEmployee(employerId, recipientId, { transaction });
    return Boolean(employee) && (await employeesActive(employerId, [employee], transaction)).get(employee.id);
  }
  const company = await findStaffingCompany(employerId, recipientId, { transaction });
  return Boolean(company) && (await staffingCompaniesActive(employerId, [company], transaction)).get(company.id);
};

module.exports = {
  AUDIENCES,
  SUPPORTED_AUDIENCES,
  employeesActive,
  staffingCompaniesActive,
  mainProjects,
  findEmployee,
  findStaffingCompany,
  isRecipientActive,
  usersWithCurrentAccount,
};
