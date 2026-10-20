const { Op } = require("sequelize");
const { sequelize, Employee, User, EmployeeExit, ExitEvent, ExitSetting } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { addDays } = require("../utils/clock");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { UUID, likePattern } = require("./department.service");
const { companyToday } = require("./companyTime.service");
const approvals = require("./approval.service");

// Raising exits, the exit list/detail and Exit settings (docs/plans/workforce-and-lifecycle.md
// D58, D61, D62, D66). Approval outcomes, withdraw and emails are ticket 16b.

const ENTITY = "EXIT";
const OPEN = ["PENDING_APPROVAL", "IN_NOTICE"];
// Type label from the UI's navigation ("Exits" / "إنهاء الخدمة"); emails come with 16b.
approvals.registerEntity(ENTITY, { moduleKey: "EXIT", label: { en: "Exit", ar: "إنهاء الخدمة" }, codePrefix: "EXT" });

const fieldError = (field, key) => new ErrorHandler("VALIDATION_FAILED", { errors: { [field]: key } });

// ---------- Exit settings ----------

const SETTING_DEFAULTS = { default_notice_days: 30, default_cooling_days: 180, default_allow_leave_during_notice: false, default_encash_leave: true, block_loans_during_notice: true };

const settingsOf = async (employerId, transaction) =>
  (await ExitSetting.findOne({ where: { employer_id: employerId }, transaction })) || { ...SETTING_DEFAULTS };

const toSettings = (s) => ({
  noticeDays: s.default_notice_days,
  coolingPeriodDays: s.default_cooling_days,
  allowLeaveDuringNotice: Boolean(s.default_allow_leave_during_notice),
  encashLeave: Boolean(s.default_encash_leave),
  blockLoansDuringNotice: Boolean(s.block_loans_during_notice),
});

const getSettings = async ({ employerId }) => toSettings(await settingsOf(employerId));

const saveSettings = async ({ employerId }, body) =>
  sequelize.transaction(async (transaction) => {
    const values = {
      default_notice_days: body.noticeDays,
      default_cooling_days: body.coolingPeriodDays,
      default_allow_leave_during_notice: body.allowLeaveDuringNotice,
      default_encash_leave: body.encashLeave,
      block_loans_during_notice: body.blockLoansDuringNotice,
    };
    const row = await ExitSetting.findOne({ where: { employer_id: employerId }, transaction, lock: transaction.LOCK.UPDATE });
    if (row) await row.update(values, { transaction });
    else await ExitSetting.create({ employer_id: employerId, ...values }, { transaction });
    return toSettings(values);
  });

// ---------- Exit items ----------

const employeeRef = (e) => (e ? { id: e.id, name: e.full_name, employee_code: e.employee_code } : null);

const toListItem = (exit) => ({
  id: exit.id,
  employee: employeeRef(exit.employee),
  exit_type: exit.exit_type,
  reason_category: exit.reason_category,
  status: exit.status,
  notice_start_date: exit.notice_start_date,
  notice_days: exit.notice_days,
  last_working_day: exit.last_working_day,
  created_at: exit.createdAt,
});

const toDetail = (exit, events = []) => ({
  ...toListItem(exit),
  reason: exit.reason,
  preferred_last_day: exit.preferred_last_day ?? null,
  original_last_working_day: exit.original_last_working_day,
  allow_leave_during_notice: Boolean(exit.allow_leave_during_notice),
  encash_leave: Boolean(exit.encash_leave),
  loan_handling: exit.loan_handling,
  rehire_eligible: Boolean(exit.rehire_eligible),
  cooling_period_days: exit.cooling_period_days ?? null,
  rehire_allowed_from: exit.rehire_allowed_from ?? null,
  approval_request_id: exit.approval_request_id ?? null,
  reject_reason: exit.reject_reason ?? null,
  cancel_reason: exit.cancel_reason ?? null,
  raised_by: exit.raisedBy ? { id: exit.raisedBy.id, name: exit.raisedBy.name } : null,
  events: events.map((e) => ({ id: e.id, event_type: e.event_type, payload: e.payload ?? null, actor_user_id: e.actor_user_id ?? null, created_at: e.createdAt })),
});

const DETAIL_INCLUDE = [
  { model: Employee, as: "employee", attributes: ["id", "full_name", "employee_code"] },
  { model: User, as: "raisedBy", attributes: ["id", "name"], required: false },
];

// The caller's exit, or 404 (also for a malformed id).
const findExit = async (employerId, id, options = {}) => {
  const exit = UUID.test(String(id)) ? await EmployeeExit.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!exit) throw new ErrorHandler("NOT_FOUND");
  return exit;
};

const getExit = async ({ employerId }, id) => {
  const exit = await findExit(employerId, id, { include: DETAIL_INCLUDE });
  const events = await ExitEvent.findAll({ where: { exit_id: exit.id }, order: [["created_at", "ASC"], ["id", "ASC"]] });
  return toDetail(exit, events);
};

// GET /exits?status=&type=&reason=&lwdMonth=&search= (name, Employee ID), newest first.
const listExits = async ({ employerId }, { page, limit, search, status, type, reason, lwdMonth }) => {
  const where = { employer_id: employerId };
  if (status) where.status = status;
  if (type) where.exit_type = type;
  if (reason) where.reason_category = reason;
  if (lwdMonth) {
    const [y, m] = lwdMonth.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    where.last_working_day = { [Op.between]: [`${lwdMonth}-01`, `${lwdMonth}-${String(last).padStart(2, "0")}`] };
  }
  const employeeWhere = search
    ? { [Op.or]: [{ full_name: { [Op.like]: likePattern(search) } }, { employee_code: { [Op.like]: likePattern(search) } }] }
    : undefined;
  const { count, rows } = await EmployeeExit.findAndCountAll({
    where,
    include: [{ model: Employee, as: "employee", attributes: ["id", "full_name", "employee_code"], where: employeeWhere }],
    order: [
      ["created_at", "DESC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  return { items: rows.map(toListItem), total: count, page, limit };
};

// ---------- POST /employees/:id/exits ----------

const can = (auth, action) => auth.accessLevel === ACCESS_LEVELS.ADMIN || auth.permissions?.employee?.[action] === true;

// Who raises (D66): anyone with an ACTIVE employee record may resign themselves; raising for
// someone else (resignation or termination) needs employee:create and employee:update; nobody
// terminates themselves. `id` "me" is the caller's own record.
const resolveSubject = async (auth, id, body, transaction) => {
  const own = await Employee.findOne({ where: { user_id: auth.userId, employer_id: auth.employerId }, transaction });
  if (id === "me" && !own) throw new ErrorHandler("FORBIDDEN");
  const subjectId = id === "me" ? own.id : id;
  const self = Boolean(own && own.id === subjectId);
  if (self && body.exitType === "TERMINATION") throw fieldError("employeeId", "exitEmployeeSelf");
  if (self && own.employment_status !== "ACTIVE" && own.employment_status !== "IN_NOTICE") throw new ErrorHandler("FORBIDDEN");
  if (!self && !(can(auth, "create") && can(auth, "update"))) throw new ErrorHandler("FORBIDDEN");
  const employee = UUID.test(String(subjectId))
    ? await Employee.findOne({ where: { id: subjectId, employer_id: auth.employerId }, transaction, lock: transaction.LOCK.UPDATE })
    : null;
  if (!employee) throw new ErrorHandler("NOT_FOUND");
  return { employee, self, own };
};

// Notice terms (D62): start within ±90 days of today (default today); days 0–180 (default from
// Exit settings); LWD = start + max(days, 1) − 1 unless given, ≥ start, ≤ start + 365, and in the
// past only for the owner. An own resignation takes the defaults and today's start.
const noticeTerms = (auth, body, settings, today, self) => {
  const start = (!self && body.noticeStartDate) || today;
  if (start < addDays(today, -90) || start > addDays(today, 90)) throw fieldError("noticeStartDate", "noticeStartInvalid");
  const days = !self && body.noticeDays !== undefined ? body.noticeDays : settings.default_notice_days;
  const lwd = (!self && body.lastWorkingDay) || addDays(start, Math.max(days, 1) - 1);
  if (lwd < start) throw fieldError("lastWorkingDay", "lwdBeforeStart");
  if (lwd > addDays(start, 365)) throw fieldError("lastWorkingDay", "lwdTooFar");
  if (lwd < today && auth.accessLevel !== ACCESS_LEVELS.ADMIN) throw fieldError("lastWorkingDay", "lwdPast");
  if (body.preferredLastDay && body.preferredLastDay < start) throw fieldError("preferredLastDay", "preferredDayBeforeStart");
  return { start, days, lwd };
};

const raiseExit = async (auth, id, body) =>
  sequelize.transaction(async (transaction) => {
    const { employee, self, own } = await resolveSubject(auth, id, body, transaction);
    if (employee.employment_status === "EXITED") throw fieldError("employeeId", "exitEmployeeInvalid");
    // The employee row is locked above, so two raises at once queue here (D59). A locking read:
    // a plain one would use this transaction's snapshot from before the wait and miss the winner.
    const open = await EmployeeExit.findOne({ where: { employee_id: employee.id, status: OPEN }, attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
    if (open) throw new ErrorHandler("EXIT_ALREADY_OPEN");

    const settings = await settingsOf(auth.employerId, transaction);
    const today = await companyToday(auth.employerId, { transaction });
    const { start, days, lwd } = noticeTerms(auth, body, settings, today, self);
    const choose = (value, fallback) => (self || value === undefined ? fallback : value);
    const exit = await EmployeeExit.create(
      {
        employer_id: auth.employerId,
        employee_id: employee.id,
        exit_type: body.exitType,
        reason_category: body.reasonCategory,
        reason: body.reason,
        notice_start_date: start,
        notice_days: days,
        preferred_last_day: body.preferredLastDay || null,
        original_last_working_day: lwd,
        last_working_day: lwd,
        allow_leave_during_notice: choose(body.allowLeaveDuringNotice, Boolean(settings.default_allow_leave_during_notice)),
        encash_leave: choose(body.encashLeave, Boolean(settings.default_encash_leave)),
        loan_handling: choose(body.loanHandling, "NONE"),
        rehire_eligible: choose(body.rehireEligible, false),
        cooling_period_days: choose(body.coolingPeriodDays, settings.default_cooling_days),
        status: "PENDING_APPROVAL",
        raised_by: auth.userId,
      },
      { transaction }
    );
    const request = await approvals.raise({
      employerId: auth.employerId,
      entityType: ENTITY,
      entityId: exit.id,
      subjectEmployeeId: employee.id,
      raisedBy: { userId: auth.userId, employeeId: own ? own.id : null },
      transaction,
    });
    await exit.update({ approval_request_id: request.id }, { transaction });
    await ExitEvent.create({ exit_id: exit.id, event_type: "RAISED", actor_user_id: auth.userId }, { transaction });
    return exit.id;
  });

module.exports = { raiseExit, listExits, getExit, getSettings, saveSettings, findExit, ENTITY, OPEN };
