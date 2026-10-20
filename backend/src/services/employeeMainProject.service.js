const { Op } = require("sequelize");
const { sequelize, EmployeeProject, EmployeeProjectHistory, EmployeeMainProjectPeriod, HrmsAccount } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { clock, addDays } = require("../utils/clock");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { findProject } = require("./project.service");
const { companyToday } = require("./companyTime.service");
const { isDateLocked } = require("./periodLock.service");
const { findEmployee, assertNotExited } = require("./employeeProfile.service");

// Main project change (docs/plans/workforce-and-lifecycle.md D55). The main period table answers
// "which main project on date X?"; records dated before the change stay on the old project.

const effectiveInvalid = () => new ErrorHandler("VALIDATION_FAILED", { errors: { effectiveFrom: "mainProjectEffectiveInvalid" } });

// The employee's main project on an ISO date, or null.
const mainProjectOn = async (employeeId, isoDate, { transaction } = {}) => {
  const period = await EmployeeMainProjectPeriod.findOne({
    where: {
      employee_id: employeeId,
      date_from: { [Op.lte]: isoDate },
      [Op.or]: [{ date_to: null }, { date_to: { [Op.gte]: isoDate } }],
    },
    attributes: ["project_id"],
    transaction,
  });
  return period ? period.project_id : null;
};

const history = (employee, projectId, action, effectiveDate, userId, transaction, previousProjectId = null) =>
  EmployeeProjectHistory.create(
    {
      employer_id: employee.employer_id,
      employee_id: employee.id,
      project_id: projectId,
      previous_project_id: previousProjectId,
      action,
      effective_date: effectiveDate,
      actioned_by: userId,
      actioned_at: clock.now(),
    },
    { transaction }
  );

// PUT /employees/:id/main-project { projectId, effectiveFrom? (default today) }. The new project
// must be ACTIVE (added if not assigned); the old main becomes secondary, or for a GENERAL_EMPLOYEE
// ends the day before (REMOVED). The date must be after the current period's start, not in the
// future and not in a locked period. Choosing the current main project changes nothing.
const changeMainProject = async ({ employerId, userId }, id, { projectId, effectiveFrom }) =>
  sequelize.transaction(async (transaction) => {
    const employee = await findEmployee(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    assertNotExited(employee);
    const project = await findProject(employerId, projectId, { transaction, lock: transaction.LOCK.SHARE });

    const period = await EmployeeMainProjectPeriod.findOne({ where: { employee_id: employee.id, date_to: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (period && period.project_id === project.id) return employee.id;
    if (project.status !== "ACTIVE") throw new ErrorHandler("PROJECT_NOT_ACTIVE");

    const today = await companyToday(employerId, { transaction });
    const from = effectiveFrom || today;
    if (from > today || (period && from <= period.date_from)) throw effectiveInvalid();
    if (await isDateLocked(employerId, from, { modules: ["ATTENDANCE", "PAYROLL"], transaction })) throw effectiveInvalid();
    const dayBefore = addDays(from, -1);

    const account = await HrmsAccount.findOne({ where: { user_id: employee.user_id, employer_id: employerId }, attributes: ["access_level"], transaction });
    const general = account && account.access_level === ACCESS_LEVELS.GENERAL_EMPLOYEE;

    // The old main: secondary from the effective date, or ended the day before (GENERAL_EMPLOYEE).
    const oldId = period ? period.project_id : null;
    if (period) {
      await period.update({ date_to: dayBefore }, { transaction });
      const old = await EmployeeProject.findOne({ where: { employee_id: employee.id, project_id: oldId, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
      if (old) {
        await old.update(
          { main_project: false, main_project_date_end: dayBefore, ...(general ? { is_active: false, end_date: dayBefore } : {}) },
          { transaction }
        );
      }
      await history(employee, oldId, "MOVED_OUT", from, userId, transaction);
      if (general) await history(employee, oldId, "REMOVED", dayBefore, userId, transaction);
    }

    // The new main: its assignment (added, restarted or kept) and its period.
    const row = await EmployeeProject.findOne({ where: { employee_id: employee.id, project_id: project.id }, transaction, lock: transaction.LOCK.UPDATE });
    const main = { main_project: true, main_project_date_start: from, main_project_date_end: null };
    if (row && row.is_active) await row.update(main, { transaction });
    else if (row) await row.update({ ...main, is_active: true, start_date: from, end_date: null }, { transaction });
    else await EmployeeProject.create({ employer_id: employerId, employee_id: employee.id, project_id: project.id, is_active: true, start_date: from, ...main }, { transaction });
    await history(employee, project.id, "MOVED_IN", from, userId, transaction, oldId);
    await EmployeeMainProjectPeriod.create({ employer_id: employerId, employee_id: employee.id, project_id: project.id, date_from: from }, { transaction });
    return employee.id;
  });

module.exports = { changeMainProject, mainProjectOn };
