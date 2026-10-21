const {
  ApprovalGroupMember,
  Department,
  Employee,
  EmployeeExit,
  EmployeeMainProjectPeriod,
  EmployeeProject,
  EmployeeProjectHistory,
  ExitEvent,
  HrmsAccount,
} = require("../models");
const { clock, addDays } = require("../utils/clock");
const { revokeSessions } = require("./auth.service");
const approvals = require("./approval.service");

// "Process exit" (docs/plans/workforce-and-lifecycle.md D63): the employee's employment ends on the
// LWD. Run by the LWD job, and at final approval, edit terms and Confirm Immediate when the LWD is
// already past. Inside the caller's transaction; the exit must be IN_NOTICE (anything else is left
// alone, so running it twice changes nothing more).
const processExit = async (exit, { transaction, now = clock.now() }) => {
  if (exit.status !== "IN_NOTICE") return false;
  const lwd = exit.last_working_day;
  const employee = await Employee.findByPk(exit.employee_id, { transaction, lock: transaction.LOCK.UPDATE });

  await exit.update({ status: "EXITED", exited_at: now, rehire_allowed_from: addDays(lwd, (exit.cooling_period_days || 0) + 1) }, { transaction });
  await employee.update({ employment_status: "EXITED", exit_date: lwd }, { transaction });
  await ExitEvent.create({ exit_id: exit.id, event_type: "EXITED" }, { transaction });

  // The login ends (ADR 0002: the email is free for another company) and every session with it.
  const account = await HrmsAccount.findOne({ where: { user_id: employee.user_id, employer_id: employee.employer_id }, transaction, lock: transaction.LOCK.UPDATE });
  if (account) {
    await account.update({ status: "INACTIVE" }, { transaction });
    await revokeSessions({ hrms_account_id: account.id }, transaction);
  }

  // Every assignment and the main period end on the LWD, each with a REMOVED row.
  const assignments = await EmployeeProject.findAll({ where: { employee_id: employee.id, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
  for (const row of assignments) {
    await row.update({ is_active: false, end_date: lwd, ...(row.main_project ? { main_project_date_end: lwd } : {}) }, { transaction });
    await EmployeeProjectHistory.create(
      { employer_id: employee.employer_id, employee_id: employee.id, project_id: row.project_id, action: "REMOVED", effective_date: lwd, actioned_at: now },
      { transaction }
    );
  }
  await EmployeeMainProjectPeriod.update({ date_to: lwd }, { where: { employee_id: employee.id, date_to: null }, transaction });

  // Approval groups (D22a, D26): their memberships end and pending requests waiting on them move on
  // (skipped) or block; an emptied level shows on the group as having no active approver.
  const memberships = await ApprovalGroupMember.findAll({ where: { employee_id: employee.id, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
  for (const m of memberships) await m.update({ is_active: false }, { transaction });
  for (const groupId of new Set(memberships.map((m) => m.approval_group_id))) await approvals.reevaluateGroup(groupId, transaction);

  await Department.update({ dept_head_id: null }, { where: { employer_id: employee.employer_id, dept_head_id: employee.id }, transaction });
  return true;
};

// The exit, locked, processed if it's still IN_NOTICE with its LWD before `today`.
const processIfDue = async (exitId, today, { transaction, now }) => {
  const exit = await EmployeeExit.findByPk(exitId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!exit || exit.status !== "IN_NOTICE" || !(exit.last_working_day < today)) return false;
  return processExit(exit, { transaction, now });
};

module.exports = { processExit, processIfDue };
