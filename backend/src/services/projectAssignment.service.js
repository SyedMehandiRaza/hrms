const { Op } = require("sequelize");
const { sequelize, Employee, EmployeeProject, EmployeeProjectHistory, HrmsAccount } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { clock } = require("../utils/clock");
const { UUID, likePattern } = require("./department.service");
const { findProject } = require("./project.service");
const { companyToday } = require("./companyTime.service");

// Assigning employees to a project from Project Detail, and taking them off
// (docs/plans/workforce-and-lifecycle.md D13–D15). Assigning adds a SECONDARY project from today;
// the main project changes only through the employee (D55).

// The project's workforce: employees with a current assignment who are ACTIVE or IN_NOTICE, with
// their role (from their login), type, staffing company and whether it's their main project.
const WORKFORCE_SQL = (where) => `
  FROM employee_projects ep
  JOIN employees e ON e.id = ep.employee_id AND e.deleted_at IS NULL
  LEFT JOIN hrms_accounts a ON a.user_id = e.user_id AND a.employer_id = e.employer_id AND a.deleted_at IS NULL
  LEFT JOIN roles r ON r.id = a.role_id
  LEFT JOIN hrms_staffing_companies s ON s.id = e.staffing_company_id
  WHERE ep.project_id = :projectId AND ep.is_active = 1 AND e.employment_status IN ('ACTIVE', 'IN_NOTICE') ${where}`;

const toMember = (row) => ({
  id: row.id,
  employee_code: row.employee_code,
  name: row.full_name,
  role: row.role_name || null,
  access_level: row.access_level || null,
  employment_type: row.employment_type,
  staffing_company: row.staffing_company || null,
  employment_status: row.employment_status,
  is_main: Boolean(row.main_project),
  start_date: row.start_date,
});

// GET /projects/:id/employees
const listWorkforce = async ({ employerId }, projectId, { search, status, page, limit }) => {
  const project = await findProject(employerId, projectId, { attributes: ["id"] });
  const replacements = { projectId: project.id, limit, offset: (page - 1) * limit };
  let where = "";
  if (search) {
    where += " AND (e.full_name LIKE :search OR e.employee_code LIKE :search)";
    replacements.search = likePattern(search);
  }
  if (status) {
    where += " AND e.employment_status = :status";
    replacements.status = status;
  }
  const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) AS total ${WORKFORCE_SQL(where)}`, { replacements });
  const [rows] = await sequelize.query(
    `SELECT e.id, e.employee_code, e.full_name, e.employment_type, e.employment_status, r.name AS role_name, a.access_level,
            s.name AS staffing_company, ep.main_project, DATE_FORMAT(ep.start_date, '%Y-%m-%d') AS start_date
     ${WORKFORCE_SQL(where)} ORDER BY ep.main_project DESC, e.full_name ASC, e.id ASC LIMIT :limit OFFSET :offset`,
    { replacements }
  );
  return { items: rows.map(toMember), total: Number(total), page, limit };
};

// GET /projects/:id/assignable-employees: ACTIVE employees not yet on the project (D13).
const listAssignable = async ({ employerId }, projectId, { search, page, limit }) => {
  const project = await findProject(employerId, projectId, { attributes: ["id"] });
  const where = {
    employer_id: employerId,
    employment_status: "ACTIVE",
    [Op.and]: [
      sequelize.literal(
        `NOT EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id = \`Employee\`.\`id\` AND ep.project_id = ${sequelize.escape(project.id)} AND ep.is_active = 1)`
      ),
    ],
  };
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [{ full_name: { [Op.like]: pattern } }, { employee_code: { [Op.like]: pattern } }];
  }
  const { count, rows } = await Employee.findAndCountAll({
    where,
    attributes: ["id", "employee_code", "full_name", "employment_type"],
    order: [
      ["full_name", "ASC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return {
    items: rows.map((e) => ({ id: e.id, employee_code: e.employee_code, name: e.full_name, employment_type: e.employment_type })),
    total: count,
    page,
    limit,
  };
};

const history = (employee, project, action, today, userId, transaction) =>
  EmployeeProjectHistory.create(
    {
      employer_id: employee.employer_id,
      employee_id: employee.id,
      project_id: project.id,
      action,
      effective_date: today,
      actioned_by: userId,
      actioned_at: clock.now(),
    },
    { transaction }
  );

// POST /projects/:id/employees { employeeIds }. All or nothing: the project must be ACTIVE, every
// employee must be an ACTIVE employee of the company, and a GENERAL_EMPLOYEE may have only one
// project. Someone already on the project is left as they are.
const assignEmployees = async ({ employerId, userId }, projectId, { employeeIds }) =>
  sequelize.transaction(async (transaction) => {
    const project = await findProject(employerId, projectId, { transaction, lock: transaction.LOCK.UPDATE });
    if (project.status !== "ACTIVE") throw new ErrorHandler("PROJECT_NOT_ACTIVE");

    if (!employeeIds.every((id) => UUID.test(id))) throw new ErrorHandler("NOT_FOUND");
    const employees = await Employee.findAll({
      where: { id: employeeIds, employer_id: employerId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (employees.length !== employeeIds.length) throw new ErrorHandler("NOT_FOUND");
    if (employees.some((e) => e.employment_status !== "ACTIVE")) {
      throw new ErrorHandler("VALIDATION_FAILED", { errors: { employeeIds: "assignInNoticeOrExited" } });
    }

    const rows = await EmployeeProject.findAll({ where: { employee_id: employeeIds }, transaction });
    const accounts = await HrmsAccount.findAll({
      where: { employer_id: employerId, user_id: employees.map((e) => e.user_id) },
      attributes: ["user_id", "access_level"],
      transaction,
    });
    const general = new Set(accounts.filter((a) => a.access_level === "GENERAL_EMPLOYEE").map((a) => a.user_id));

    const today = await companyToday(employerId, { transaction });
    const assigned = [];
    for (const employee of employees) {
      const mine = rows.filter((r) => r.employee_id === employee.id);
      const here = mine.find((r) => r.project_id === project.id);
      if (here && here.is_active) continue; // already on the project
      if (general.has(employee.user_id) && mine.some((r) => r.is_active)) throw new ErrorHandler("PROJECT_GENERAL_EMPLOYEE_SINGLE");
      if (here) {
        // Removed earlier: the same row starts again from today (one row per employee and project).
        await here.update(
          { is_active: true, start_date: today, end_date: null, main_project: false, main_project_date_start: null, main_project_date_end: null },
          { transaction }
        );
      } else {
        await EmployeeProject.create(
          { employer_id: employerId, employee_id: employee.id, project_id: project.id, is_active: true, start_date: today, main_project: false },
          { transaction }
        );
      }
      await history(employee, project, "ASSIGNED", today, userId, transaction);
      assigned.push(employee.id);
    }
    return { assigned };
  });

// DELETE /projects/:id/employees/:employeeId. The assignment ends today with a REMOVED row; the
// employee's main project can't be removed this way (D14).
const removeEmployee = async ({ employerId, userId }, projectId, employeeId) =>
  sequelize.transaction(async (transaction) => {
    const project = await findProject(employerId, projectId, { transaction });
    const employee = UUID.test(String(employeeId))
      ? await Employee.findOne({ where: { id: employeeId, employer_id: employerId }, transaction })
      : null;
    const row = employee
      ? await EmployeeProject.findOne({
          where: { employee_id: employee.id, project_id: project.id, is_active: true },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : null;
    if (!row) throw new ErrorHandler("NOT_FOUND");
    if (row.main_project) throw new ErrorHandler("PROJECT_REMOVE_MAIN");

    const today = await companyToday(employerId, { transaction });
    await row.update({ is_active: false, end_date: today }, { transaction });
    await history(employee, project, "REMOVED", today, userId, transaction);
    return { id: employee.id };
  });

module.exports = { listWorkforce, listAssignable, assignEmployees, removeEmployee };
