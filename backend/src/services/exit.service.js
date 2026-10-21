const { Op } = require("sequelize");
const {
  sequelize,
  ApprovalGroup,
  ApprovalGroupMember,
  ApprovalRequest,
  Department,
  Employee,
  EmployeeProject,
  Project,
  User,
  EmployeeExit,
  ExitEvent,
  ExitSetting,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { clock, addDays } = require("../utils/clock");
const { ACCESS_LEVELS } = require("../constants/accessLevels");
const { UUID, likePattern } = require("./department.service");
const { companyToday } = require("./companyTime.service");
const approvals = require("./approval.service");
const { processExit } = require("./exitProcess.service");
const { REASONS, STATUSES } = require("../validations/exit.validation");

// Raising exits, approval outcomes, withdraw, the exit list/detail and Exit settings
// (docs/plans/workforce-and-lifecycle.md D58, D59, D61, D62, D66, D68).

const ENTITY = "EXIT";
const OPEN = ["PENDING_APPROVAL", "IN_NOTICE"];

const userTo = (id, transaction) => (id ? User.findByPk(id, { attributes: ["id", "email", "lang_key"], transaction }) : null);
const mailTo = (user, template, data) => ({ to: user.email, lang: user.lang_key, template, data });

// The exit an approval request is for, locked (the request is already locked by the engine).
const exitOfRequest = (request, transaction) =>
  EmployeeExit.findOne({ where: { id: request.entity_id, employer_id: request.employer_id }, transaction, lock: transaction.LOCK.UPDATE });

// D59, D68: final approval → exit and employee IN_NOTICE; the raiser is emailed, and so is the
// leaving employee when someone else raised it. An LWD already past is processed at once (D63).
const onApproved = async (request, { transaction, actorUserId = null }) => {
  const exit = await exitOfRequest(request, transaction);
  if (!exit || exit.status !== "PENDING_APPROVAL") return;
  const employee = await Employee.findByPk(exit.employee_id, { transaction, lock: transaction.LOCK.UPDATE });
  await exit.update({ status: "IN_NOTICE" }, { transaction });
  await employee.update({ employment_status: "IN_NOTICE" }, { transaction });
  await ExitEvent.create({ exit_id: exit.id, event_type: "APPROVED", actor_user_id: actorUserId }, { transaction });
  if (exit.last_working_day < (await companyToday(exit.employer_id, { transaction }))) await processExit(exit, { transaction });

  const mails = [];
  const raiser = await userTo(exit.raised_by, transaction);
  if (raiser) mails.push(mailTo(raiser, "exit-approved", { employeeName: employee.full_name, lastWorkingDay: exit.last_working_day }));
  if (employee.user_id && employee.user_id !== exit.raised_by) {
    const leaver = await userTo(employee.user_id, transaction);
    if (leaver) mails.push(mailTo(leaver, "exit-approved-employee", { lastWorkingDay: exit.last_working_day }));
  }
  approvals.queueMails(transaction, mails);
};

// D59, D68: rejection → exit REJECTED with the reason (the employee is unchanged); the raiser is emailed.
const onRejected = async (request, { transaction, reason }) => {
  const exit = await exitOfRequest(request, transaction);
  if (!exit || exit.status !== "PENDING_APPROVAL") return;
  await exit.update({ status: "REJECTED", reject_reason: reason }, { transaction });
  await ExitEvent.create({ exit_id: exit.id, event_type: "REJECTED", payload: { reason } }, { transaction });
  const raiser = await userTo(exit.raised_by, transaction);
  const employee = await Employee.findByPk(exit.employee_id, { attributes: ["full_name"], transaction });
  if (raiser) approvals.queueMails(transaction, [mailTo(raiser, "exit-rejected", { employeeName: employee.full_name, reason })]);
};

// Type label from the UI's navigation ("Exits" / "إنهاء الخدمة").
approvals.registerEntity(ENTITY, {
  moduleKey: "EXIT",
  label: { en: "Exit", ar: "إنهاء الخدمة" },
  codePrefix: "EXT",
  approvalTemplate: "exit-approval-needed",
  onApproved,
  onRejected,
});

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
  reject_reason: exit.reject_reason ?? null,
  cancel_reason: exit.cancel_reason ?? null,
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
  // Every LWD change, oldest first (D65).
  lwd_history: events
    .filter((e) => e.event_type === "LWD_EXTENDED")
    .map((e) => ({ from: e.payload.old.last_working_day, to: e.payload.new.last_working_day, actor_user_id: e.actor_user_id ?? null, created_at: e.createdAt })),
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

// D68: a termination raised by someone else stays hidden from the leaving employee until its
// final approval (one never approved stays hidden). Returns the hidden exit ids.
const hiddenFrom = async (auth) => {
  const own = await Employee.findOne({ where: { user_id: auth.userId, employer_id: auth.employerId }, attributes: ["id"] });
  if (!own) return [];
  const ids = (
    await EmployeeExit.findAll({ where: { employee_id: own.id, exit_type: "TERMINATION", raised_by: { [Op.ne]: auth.userId } }, attributes: ["id"] })
  ).map((e) => e.id);
  if (!ids.length) return [];
  const approved = new Set((await ExitEvent.findAll({ where: { exit_id: ids, event_type: "APPROVED" }, attributes: ["exit_id"] })).map((e) => e.exit_id));
  return ids.filter((id) => !approved.has(id));
};

const getExit = async (auth, id) => {
  const exit = await findExit(auth.employerId, id, { include: DETAIL_INCLUDE });
  if ((await hiddenFrom(auth)).includes(exit.id)) throw new ErrorHandler("NOT_FOUND");
  const events = await ExitEvent.findAll({ where: { exit_id: exit.id }, order: [["created_at", "ASC"], ["id", "ASC"]] });
  return { ...toDetail(exit, events), approval: await approvals.progress(exit.approval_request_id) };
};

// GET /exits?status=&type=&reason=&lwdMonth=&search= (name, Employee ID), newest first. `status`
// is a list (one or more). `counts`: exits per status with every filter but the status (the tabs).
const listExits = async (auth, { page, limit, search, status, type, reason, lwdMonth }) => {
  const where = { employer_id: auth.employerId };
  const hidden = await hiddenFrom(auth);
  if (hidden.length) where.id = { [Op.notIn]: hidden };
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
  const employeeInclude = { model: Employee, as: "employee", attributes: [], where: employeeWhere };
  const perStatus = await EmployeeExit.findAll({
    where,
    include: [employeeInclude],
    attributes: ["status", [sequelize.fn("COUNT", sequelize.col("EmployeeExit.id")), "n"]],
    group: ["EmployeeExit.status"],
    raw: true,
  });
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  perStatus.forEach((r) => (counts[r.status] = Number(r.n)));
  const { count, rows } = await EmployeeExit.findAndCountAll({
    where: status && status.length ? { ...where, status: { [Op.in]: status } } : where,
    include: [{ model: Employee, as: "employee", attributes: ["id", "full_name", "employee_code"], where: employeeWhere }],
    order: [
      ["created_at", "DESC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  return { items: rows.map(toListItem), total: count, page, limit, counts };
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

// ---------- GET /employees/:id/exit-preview ----------

// What the raise-exit wizard shows before submitting: the Exit settings defaults (D62) and the
// handover warnings (D65): active approval groups the employee approves in, pending requests still
// waiting on one of their levels, departments they head, current projects. Warnings never block.
// Same access as raising: the employee themselves, or employee:create + employee:update.
const exitPreview = async (auth, id) => {
  const own = await Employee.findOne({ where: { user_id: auth.userId, employer_id: auth.employerId } });
  if (id === "me" && !own) throw new ErrorHandler("FORBIDDEN");
  const subjectId = id === "me" ? own.id : id;
  const self = Boolean(own && own.id === subjectId);
  if (!self && !(can(auth, "create") && can(auth, "update"))) throw new ErrorHandler("FORBIDDEN");
  const employee = UUID.test(String(subjectId)) ? await Employee.findOne({ where: { id: subjectId, employer_id: auth.employerId } }) : null;
  if (!employee) throw new ErrorHandler("NOT_FOUND");

  const settings = toSettings(await settingsOf(auth.employerId));
  const memberships = await ApprovalGroupMember.findAll({
    where: { employee_id: employee.id, is_active: true },
    include: [{ model: ApprovalGroup, as: "approvalGroup", where: { is_active: true }, attributes: ["id", "group_name"] }],
  });
  const groups = [...new Map(memberships.map((m) => [m.approvalGroup.id, m.approvalGroup])).values()].sort((a, b) =>
    a.group_name.localeCompare(b.group_name)
  );
  const pending = memberships.length
    ? await ApprovalRequest.findAll({
        where: { employer_id: auth.employerId, approval_group_id: groups.map((g) => g.id), final_status: ["PENDING", "IN_PROGRESS"] },
        attributes: ["approval_group_id", "current_level"],
      })
    : [];
  const waiting = pending.filter((r) => memberships.some((m) => m.approval_group_id === r.approval_group_id && m.level_no >= r.current_level));
  const departments = await Department.findAll({ where: { employer_id: auth.employerId, dept_head_id: employee.id }, attributes: ["id", "name"], order: [["name", "ASC"]] });
  const assignments = await EmployeeProject.findAll({
    where: { employee_id: employee.id, is_active: true },
    include: [{ model: Project, as: "project", attributes: ["id", "project_name", "project_code"] }],
  });
  return {
    defaults: {
      noticeStartDate: await companyToday(auth.employerId),
      noticeDays: settings.noticeDays,
      coolingPeriodDays: settings.coolingPeriodDays,
      allowLeaveDuringNotice: settings.allowLeaveDuringNotice,
      encashLeave: settings.encashLeave,
    },
    warnings: {
      approval_groups: groups.map((g) => ({ id: g.id, name: g.group_name })),
      pending_approvals: waiting.length,
      departments_headed: departments.map((d) => ({ id: d.id, name: d.name })),
      projects: assignments
        .map((a) => ({ id: a.project.id, name: a.project.project_name, code: a.project.project_code }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
};

// LWD bounds (D62): ≥ the notice start, ≤ start + 365, and in the past only for the owner.
const checkLwd = (auth, lwd, start, today) => {
  if (lwd < start) throw fieldError("lastWorkingDay", "lwdBeforeStart");
  if (lwd > addDays(start, 365)) throw fieldError("lastWorkingDay", "lwdTooFar");
  if (lwd < today && auth.accessLevel !== ACCESS_LEVELS.ADMIN) throw fieldError("lastWorkingDay", "lwdPast");
};

// Notice terms (D62): start within ±90 days of today (default today); days 0–180 (default from
// Exit settings); LWD = start + max(days, 1) − 1 unless given, within checkLwd's bounds. An own
// resignation takes the defaults and today's start.
const noticeTerms = (auth, body, settings, today, self) => {
  const start = (!self && body.noticeStartDate) || today;
  if (start < addDays(today, -90) || start > addDays(today, 90)) throw fieldError("noticeStartDate", "noticeStartInvalid");
  const days = !self && body.noticeDays !== undefined ? body.noticeDays : settings.default_notice_days;
  const lwd = (!self && body.lastWorkingDay) || addDays(start, Math.max(days, 1) - 1);
  checkLwd(auth, lwd, start, today);
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

// ---------- POST /exits/:id/withdraw ----------

// D59: the raiser, the owner, or employee:create + update withdraws a pending exit with a reason →
// exit CANCELLED, its approval request CANCELLED (it leaves every inbox), exit event WITHDRAWN.
const withdrawExit = async (auth, id, { reason }) =>
  sequelize.transaction(async (transaction) => {
    const found = await findExit(auth.employerId, id, { transaction });
    if (found.raised_by !== auth.userId && !(can(auth, "create") && can(auth, "update"))) throw new ErrorHandler("FORBIDDEN");
    // Lock order as in an approval decision: the request, then the exit.
    if (found.approval_request_id) await ApprovalRequest.findByPk(found.approval_request_id, { transaction, lock: transaction.LOCK.UPDATE });
    const exit = await findExit(auth.employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (exit.status !== "PENDING_APPROVAL") throw new ErrorHandler("EXIT_INVALID_STATE");
    if (exit.approval_request_id) await approvals.cancel(exit.approval_request_id, { transaction });
    await exit.update({ status: "CANCELLED", cancel_reason: reason }, { transaction });
    await ExitEvent.create({ exit_id: exit.id, event_type: "WITHDRAWN", payload: { reason }, actor_user_id: auth.userId }, { transaction });
    return exit.id;
  });

// ---------- In notice: edit terms, cancel, Confirm → Immediate (D64, D65) ----------

// The caller's exit, locked; anything but IN_NOTICE → EXIT_INVALID_STATE.
const lockInNotice = async (auth, id, transaction) => {
  const exit = await findExit(auth.employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
  if (exit.status !== "IN_NOTICE") throw new ErrorHandler("EXIT_INVALID_STATE");
  return exit;
};

// An LWD change, kept as an exit event (the LWD history).
const lwdChanged = (exit, from, auth, transaction) =>
  ExitEvent.create(
    { exit_id: exit.id, event_type: "LWD_EXTENDED", payload: { old: { last_working_day: from }, new: { last_working_day: exit.last_working_day } }, actor_user_id: auth.userId },
    { transaction }
  );

// Editable terms: body field → column.
const TERMS = {
  reasonCategory: "reason_category",
  reason: "reason",
  noticeDays: "notice_days",
  preferredLastDay: "preferred_last_day",
  allowLeaveDuringNotice: "allow_leave_during_notice",
  encashLeave: "encash_leave",
  loanHandling: "loan_handling",
  rehireEligible: "rehire_eligible",
  coolingPeriodDays: "cooling_period_days",
};

// PUT /exits/:id/terms (D65): employee:create + update; no re-approval and the original LWD stays.
// New notice days without an LWD move the LWD to start + max(days, 1) − 1. Changed terms → event
// TERMS_UPDATED, a changed LWD → LWD_EXTENDED (old and new values each). An LWD now in the past
// (owner only) is processed at once (D63).
const editTerms = async (auth, id, body) =>
  sequelize.transaction(async (transaction) => {
    if (!(can(auth, "create") && can(auth, "update"))) throw new ErrorHandler("FORBIDDEN");
    const exit = await lockInNotice(auth, id, transaction);
    if (body.reasonCategory && !REASONS[exit.exit_type].includes(body.reasonCategory)) throw fieldError("reasonCategory", "exitReasonCategory");
    const today = await companyToday(auth.employerId, { transaction });
    const start = exit.notice_start_date;
    const from = exit.last_working_day;
    const lwd = body.lastWorkingDay || (body.noticeDays !== undefined ? addDays(start, Math.max(body.noticeDays, 1) - 1) : from);
    if (lwd !== from) checkLwd(auth, lwd, start, today);
    if (body.preferredLastDay && body.preferredLastDay < start) throw fieldError("preferredLastDay", "preferredDayBeforeStart");

    const before = {};
    const after = {};
    for (const [key, column] of Object.entries(TERMS)) {
      if (body[key] === undefined) continue;
      const current = typeof body[key] === "boolean" ? Boolean(exit[column]) : exit[column];
      if (current === body[key]) continue;
      before[column] = current ?? null;
      after[column] = body[key];
    }
    const termsChanged = Object.keys(after).length > 0;
    if (!termsChanged && lwd === from) return exit.id;

    await exit.update({ ...after, last_working_day: lwd }, { transaction });
    if (termsChanged) await ExitEvent.create({ exit_id: exit.id, event_type: "TERMS_UPDATED", payload: { old: before, new: after }, actor_user_id: auth.userId }, { transaction });
    if (lwd !== from) await lwdChanged(exit, from, auth, transaction);
    if (lwd < today) await processExit(exit, { transaction });
    return exit.id;
  });

// POST /exits/:id/cancel (D65): employee:create + update, reason 5–500 → exit CANCELLED, employee
// back to ACTIVE, exit event CANCELLED.
const cancelExit = async (auth, id, { reason }) =>
  sequelize.transaction(async (transaction) => {
    if (!(can(auth, "create") && can(auth, "update"))) throw new ErrorHandler("FORBIDDEN");
    const exit = await lockInNotice(auth, id, transaction);
    const employee = await Employee.findByPk(exit.employee_id, { transaction, lock: transaction.LOCK.UPDATE });
    await exit.update({ status: "CANCELLED", cancel_reason: reason, cancelled_by: auth.userId, cancelled_at: clock.now() }, { transaction });
    await employee.update({ employment_status: "ACTIVE" }, { transaction });
    await ExitEvent.create({ exit_id: exit.id, event_type: "CANCELLED", payload: { reason }, actor_user_id: auth.userId }, { transaction });
    return exit.id;
  });

// POST /exits/:id/confirm-immediate (D64, owner only — checked by the route): reason 10–500 →
// LWD = today and the exit is processed now (exit date = today).
const confirmImmediate = async (auth, id, { reason }) =>
  sequelize.transaction(async (transaction) => {
    const exit = await lockInNotice(auth, id, transaction);
    const today = await companyToday(auth.employerId, { transaction });
    const from = exit.last_working_day;
    await exit.update(
      { last_working_day: today, confirm_mode: "IMMEDIATE", confirm_override_reason: reason, confirmed_by: auth.userId, confirmed_at: clock.now() },
      { transaction }
    );
    if (from !== today) await lwdChanged(exit, from, auth, transaction);
    await ExitEvent.create({ exit_id: exit.id, event_type: "CONFIRMED_WITH_OVERRIDE", payload: { mode: "IMMEDIATE", reason }, actor_user_id: auth.userId }, { transaction });
    await processExit(exit, { transaction });
    return exit.id;
  });

module.exports = { exitPreview, raiseExit, withdrawExit, editTerms, cancelExit, confirmImmediate, listExits, getExit, getSettings, saveSettings, findExit, ENTITY, OPEN };
