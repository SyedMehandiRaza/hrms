const { Op } = require("sequelize");
const {
  sequelize,
  User,
  HrmsAccount,
  Employee,
  EmployeeProject,
  EmployeeProjectHistory,
  EmployeeMainProjectPeriod,
  EmployeeApprovalRouting,
  ExitEvent,
  Project,
  Role,
  Department,
  Designation,
  StaffingCompany,
  ApprovalGroup,
  CompanyShift,
  LeavePolicy,
  LeaveType,
  EmployeeLeavePolicy,
  LeaveBalance,
  SalaryComponent,
  EmployeeSalary,
  EmployeeSalaryComponent,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { clock, addDays } = require("../utils/clock");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { UUID } = require("./department.service");
const { companyToday, financialYearOn } = require("./companyTime.service");
const { assertEmailFreeForNewAccount, issueLoginCredentials } = require("./credentials.service");
const { checkAccess, checkJob, assignLeave, changeShift, MODULE_ALL } = require("./employee.service");
const { findExit } = require("./exit.service");

// Rehire (docs/plans/workforce-and-lifecycle.md D67): an exited employee comes back on the same
// record, Employee ID and account. One transaction; the login email goes out after commit.

const fieldError = (field, key) => new ErrorHandler("VALIDATION_FAILED", { errors: { [field]: key } });
const JOB_FIELDS = ["employmentType", "accessLevel", "roleId", "departmentId", "designationId", "staffingCompanyId"];

// The exit, locked, with its employee: only an EXITED exit whose employee is still exited and
// wasn't rehired from it; eligible; on or after rehire_allowed_from; at most 90 days ahead.
const lockRehirable = async (auth, id, rehireDate, today, transaction) => {
  const exit = await findExit(auth.employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
  const employee = await Employee.findByPk(exit.employee_id, { transaction, lock: transaction.LOCK.UPDATE });
  const rehired = await ExitEvent.count({ where: { exit_id: exit.id, event_type: "REHIRED" }, transaction });
  if (exit.status !== "EXITED" || employee.employment_status !== "EXITED" || rehired) throw new ErrorHandler("EXIT_INVALID_STATE");
  if (!exit.rehire_eligible) throw new ErrorHandler("REHIRE_NOT_ELIGIBLE");
  if (rehireDate > addDays(today, 90)) throw fieldError("rehireDate", "rehireTooFar");
  if (exit.rehire_allowed_from && rehireDate < exit.rehire_allowed_from) {
    throw new ErrorHandler("REHIRE_NOT_ALLOWED", { params: { date: exit.rehire_allowed_from } });
  }
  return { exit, employee };
};

// The chosen project, else the last main project; it must be the company's and ACTIVE.
const mainProjectFor = async (employerId, employee, chosenId, transaction) => {
  let projectId = chosenId;
  if (!projectId) {
    const last = await EmployeeMainProjectPeriod.findOne({ where: { employee_id: employee.id }, order: [["date_from", "DESC"]], transaction });
    projectId = last ? last.project_id : null;
  }
  const project = UUID.test(String(projectId))
    ? await Project.findOne({ where: { id: projectId, employer_id: employerId }, transaction, lock: transaction.LOCK.SHARE })
    : null;
  if (!project || project.status !== "ACTIVE") throw fieldError("mainProjectId", "mainProjectActive");
  return project;
};

const activeId = async (Model, employerId, id, transaction, where = { status: "ACTIVE" }) =>
  id && (await Model.count({ where: { id, employer_id: employerId, ...where }, transaction })) ? id : null;

// Job fields as kept from before the exit: employment type; access level (SUB_ADMIN only when the
// owner rehires, else EMPLOYEE); role, department, designation, staffing company while still
// active (the designation goes with its department). Fields in the body override them; a new
// department without a designation drops the old designation.
const jobFields = async (auth, employee, account, body, transaction) => {
  const { employerId } = auth;
  const owner = auth.accessLevel === ACCESS_LEVELS.ADMIN;
  const departmentId = await activeId(Department, employerId, employee.department_id, transaction);
  const designationId = departmentId
    ? await activeId(Designation, employerId, employee.designation_id, transaction, { status: "ACTIVE", department_id: departmentId })
    : null;
  const kept = {
    employmentType: employee.employment_type,
    accessLevel: account.access_level === ACCESS_LEVELS.SUB_ADMIN && !owner ? ACCESS_LEVELS.EMPLOYEE : account.access_level,
    roleId: await activeId(Role, employerId, account.role_id, transaction, {}),
    departmentId,
    designationId,
    staffingCompanyId: await activeId(StaffingCompany, employerId, employee.staffing_company_id, transaction),
  };
  const job = { ...kept };
  for (const key of JOB_FIELDS) if (body[key] !== undefined) job[key] = body[key] || null;
  if (body.departmentId !== undefined && body.designationId === undefined && job.departmentId !== kept.departmentId) job.designationId = null;
  return job;
};

// Projects (D67): secondary projects stay ended; the main project starts again on the rehire date
// (one row per employee and project), with an ASSIGNED row and a new main period.
const restartMainProject = async ({ auth, employee, main, rehireDate }, transaction) => {
  const { employerId, userId } = auth;
  await EmployeeProject.update({ main_project: false }, { where: { employee_id: employee.id, project_id: { [Op.ne]: main.id } }, transaction });
  const values = { is_active: true, start_date: rehireDate, end_date: null, main_project: true, main_project_date_start: rehireDate, main_project_date_end: null };
  const row = await EmployeeProject.findOne({ where: { employee_id: employee.id, project_id: main.id }, transaction, lock: transaction.LOCK.UPDATE });
  if (row) await row.update(values, { transaction });
  else await EmployeeProject.create({ employer_id: employerId, employee_id: employee.id, project_id: main.id, ...values }, { transaction });
  await EmployeeProjectHistory.create(
    { employer_id: employerId, employee_id: employee.id, project_id: main.id, action: "ASSIGNED", effective_date: rehireDate, actioned_by: userId, actioned_at: clock.now() },
    { transaction }
  );
  await EmployeeMainProjectPeriod.create({ employer_id: employerId, employee_id: employee.id, project_id: main.id, date_from: rehireDate }, { transaction });
};

// Salary (D67): the last salary ends on the exit date and a copy starts on the rehire date, with
// the components that are still active.
const restartSalary = async ({ employee, exitDate, rehireDate }, transaction) => {
  const last = await EmployeeSalary.findOne({ where: { employee_id: employee.id }, order: [["effective_from", "DESC"]], transaction, lock: transaction.LOCK.UPDATE });
  if (!last) return;
  const parts = await EmployeeSalaryComponent.findAll({
    where: { employee_salary_id: last.id },
    include: [{ model: SalaryComponent, as: "salaryComponent", attributes: ["is_active"] }],
    transaction,
  });
  await last.update({ is_active: false, effective_to: last.effective_to || exitDate }, { transaction });
  const row = await EmployeeSalary.create(
    {
      employer_id: last.employer_id,
      employee_id: employee.id,
      currency: last.currency,
      salary_calc_mode: last.salary_calc_mode,
      working_hours: last.working_hours,
      min_hours: last.min_hours,
      effective_from: rehireDate,
      is_active: true,
    },
    { transaction }
  );
  for (const part of parts.filter((p) => p.salaryComponent && p.salaryComponent.is_active)) {
    await EmployeeSalaryComponent.create(
      { employee_salary_id: row.id, salary_component_id: part.salary_component_id, calculation_type: part.calculation_type, amount: part.amount, percent_base: part.percent_base },
      { transaction }
    );
  }
};

// Leave (D67, D33, D34): the old assignments end on the exit date; policies still active (policy
// and type) start again on the rehire date with fresh balances as at create — the old balance for
// that leave type and year is set aside (soft-deleted).
const restartLeave = async ({ auth, employee, exitDate, rehireDate, today }, transaction) => {
  const { employerId, userId } = auth;
  const current = await EmployeeLeavePolicy.findAll({ where: { employee_id: employee.id, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
  for (const row of current) await row.update({ is_active: false, effective_to: row.effective_to || exitDate }, { transaction });
  const policies = (
    await LeavePolicy.findAll({
      where: { id: current.map((r) => r.leave_policy_id), employer_id: employerId, is_active: true },
      include: [{ model: LeaveType, as: "leaveType", attributes: ["id", "is_active"], where: { is_active: true } }],
      transaction,
    })
  );
  if (!policies.length) return;
  const fy = await financialYearOn(employerId, rehireDate > today ? rehireDate : today, { transaction });
  if (fy) {
    await LeaveBalance.destroy({ where: { employee_id: employee.id, leave_type_id: policies.map((p) => p.leave_type_id), balance_year: fy.year_key }, transaction });
  }
  await assignLeave({ employerId, userId, employee, policies, joiningDate: rehireDate, today }, transaction);
};

// Approval group (D67, D51): kept while active (a PROJECT group only for the main project);
// otherwise the routing is removed.
const keepRouting = async ({ employerId, employee, main }, transaction) => {
  const routing = await EmployeeApprovalRouting.findOne({ where: { employee_id: employee.id, module_key: MODULE_ALL }, transaction });
  if (!routing) return null;
  const group = await ApprovalGroup.findOne({ where: { id: routing.approval_group_id, employer_id: employerId, is_active: true }, transaction });
  if (group && (group.scope !== "PROJECT" || group.project_id === main.id)) return group;
  await routing.destroy({ transaction });
  return null;
};

// POST /exits/:id/rehire
const rehire = async (auth, id, body) =>
  sequelize.transaction(async (transaction) => {
    const { employerId, userId } = auth;
    const today = await companyToday(employerId, { transaction });
    const rehireDate = body.rehireDate || today;
    const { exit, employee } = await lockRehirable(auth, id, rehireDate, today, transaction);

    // ADR 0002: no current account in another company.
    const user = await User.findByPk(employee.user_id, { transaction, lock: transaction.LOCK.UPDATE });
    await assertEmailFreeForNewAccount(user.email, employerId, transaction);
    const account = await HrmsAccount.findOne({ where: { user_id: user.id, employer_id: employerId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!account) throw new Error(`employee ${employee.id} has no account in company ${employerId}`);

    const main = await mainProjectFor(employerId, employee, body.mainProjectId, transaction);
    if (main.start_date && rehireDate < main.start_date) throw fieldError("rehireDate", "joiningBeforeProjectStart");
    const job = await jobFields(auth, employee, account, body, transaction);
    const role = await checkAccess(auth, job, transaction);
    await checkJob(employerId, job, transaction);
    const shift = employee.shift_id ? await CompanyShift.findOne({ where: { id: employee.shift_id, employer_id: employerId }, transaction }) : null;

    const exitDate = employee.exit_date || exit.last_working_day;
    await account.update({ status: "ACTIVE", access_level: job.accessLevel, role_id: role ? role.id : null, updated_by: userId }, { transaction });
    await employee.update(
      {
        employment_status: "ACTIVE",
        date_of_joining: rehireDate,
        exit_date: null,
        employment_type: job.employmentType,
        department_id: job.departmentId,
        designation_id: job.designationId,
        staffing_company_id: job.staffingCompanyId,
        shift_id: shift ? shift.id : null,
      },
      { transaction }
    );
    await restartMainProject({ auth, employee, main, rehireDate }, transaction);
    await changeShift({ employerId, employee, shift, today: rehireDate }, transaction);
    await restartSalary({ employee, exitDate, rehireDate }, transaction);
    await restartLeave({ auth, employee, exitDate, rehireDate, today }, transaction);
    const group = await keepRouting({ employerId, employee, main }, transaction);
    await ExitEvent.create({ exit_id: exit.id, event_type: "REHIRED", payload: { rehire_date: rehireDate }, actor_user_id: userId }, { transaction });

    // D67: a new temporary password and setup link, even for someone who had set their own.
    await issueLoginCredentials({ userId: user.id, accountId: account.id, transaction, forceTemporary: true });
    return {
      id: employee.id,
      employee_code: employee.employee_code,
      name: employee.full_name,
      email: user.email,
      access_level: account.access_level,
      role_id: account.role_id ?? null,
      employment_type: employee.employment_type,
      employment_status: employee.employment_status,
      joining_date: employee.date_of_joining,
      main_project_id: main.id,
      approval_group_id: group ? group.id : null,
    };
  });

module.exports = { rehire };
