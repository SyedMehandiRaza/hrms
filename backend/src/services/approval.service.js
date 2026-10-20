const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  ApprovalGroup,
  ApprovalGroupMember,
  ApprovalRequest,
  ApprovalRequestLog,
  Employee,
  EmployeeApprovalRouting,
  Employer,
  User,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { clock } = require("../utils/clock");
const mailer = require("./mailer");
const { UUID } = require("./department.service");

// The approval engine (docs/plans/workforce-and-lifecycle.md D18, D23–D29, ADR 0011). Any entity
// (exit first) registers itself and sends requests through the subject employee's approval group:
// levels approve in order; at a level every mandatory approver must approve, or any one when none
// is mandatory; any rejection ends the request. The group is frozen on the request, its members
// are read live. An employee with no group gets an owner-only request.

const PENDING = ["PENDING", "IN_PROGRESS"];
const MODULE_ALL = "ALL";

// entityType → { moduleKey, label: { en, ar }, codePrefix, approvalTemplate, onApproved, onRejected }
const entities = new Map();
const registerEntity = (entityType, definition) => entities.set(entityType, definition);
const entityOf = (entityType) => {
  const entity = entities.get(entityType);
  if (!entity) throw new Error(`approval: unknown entity type ${entityType}`);
  return entity;
};

// Who may act at a level, read live (D28). Overridable by the edge rules (11b): `canAct`.
const rules = {
  canAct: (member) => member.is_active && member.employee && ["ACTIVE", "IN_NOTICE"].includes(member.employee.employment_status),
};

const liveMembers = (groupId, level, transaction) =>
  ApprovalGroupMember.findAll({
    where: { approval_group_id: groupId, level_no: level, is_active: true },
    include: [{ model: Employee, as: "employee", attributes: ["id", "user_id", "full_name", "employment_status"], required: true }],
    transaction,
  });

const actorsAt = async (request, level, transaction) =>
  (await liveMembers(request.approval_group_id, level, transaction)).filter((m) => rules.canAct(m, request));

// Emails are sent after the transaction commits; a failed email never fails the request.
const queueMails = (transaction, mails) => {
  if (!mails.length) return;
  transaction.afterCommit(async () => {
    for (const mail of mails) {
      try {
        await mailer.send(mail);
      } catch (err) {
        console.error("[approvals] could not send email", { template: mail.template, error: err.message });
      }
    }
  });
};

const subjectName = async (request, transaction) => {
  if (!request.subject_employee_id) return "";
  const e = await Employee.findByPk(request.subject_employee_id, { attributes: ["full_name"], transaction });
  return e ? e.full_name : "";
};

// The "needs your approval" emails to the people who can act at the request's current level
// (the owner for an owner-only request).
const notifyCurrentLevel = async (request, transaction) => {
  const entity = entityOf(request.entity_type);
  if (!entity.approvalTemplate) return;
  const employeeName = await subjectName(request, transaction);
  let users;
  if (request.approval_group_id) {
    const actors = await actorsAt(request, request.current_level, transaction);
    users = await User.findAll({ where: { id: actors.map((m) => m.employee.user_id) }, attributes: ["email", "lang_key"], transaction });
  } else {
    const employer = await Employer.findByPk(request.employer_id, { attributes: ["user_id"], transaction });
    users = await User.findAll({ where: { id: employer.user_id }, attributes: ["email", "lang_key"], transaction });
  }
  queueMails(
    transaction,
    users.map((u) => ({ to: u.email, lang: u.lang_key, template: entity.approvalTemplate, data: { employeeName } }))
  );
};

// Pending log rows for the people who can act at the request's current level.
const openLevel = async (request, transaction) => {
  const actors = await actorsAt(request, request.current_level, transaction);
  for (const m of actors) {
    await ApprovalRequestLog.create(
      { approval_request_id: request.id, approval_group_member_id: m.id, employee_id: m.employee_id, level_no: request.current_level, status: "PENDING" },
      { transaction }
    );
  }
};

// Raises a request for `subjectEmployeeId` (inside the caller's transaction). The subject's group
// (routing ALL) is frozen on the request; no group (or an inactive one) → owner-only.
const raise = async ({ employerId, entityType, entityId, subjectEmployeeId, raisedBy, transaction }) => {
  const entity = entityOf(entityType);
  const routing = await EmployeeApprovalRouting.findOne({
    where: { employer_id: employerId, employee_id: subjectEmployeeId, module_key: MODULE_ALL },
    include: [{ model: ApprovalGroup, as: "approvalGroup", where: { is_active: true }, required: true }],
    transaction,
  });
  const group = routing ? routing.approvalGroup : null;
  const request = await ApprovalRequest.create(
    {
      employer_id: employerId,
      approval_group_id: group ? group.id : null,
      module_key: entity.moduleKey,
      entity_type: entityType,
      entity_id: entityId,
      subject_employee_id: subjectEmployeeId,
      request_code: `${entity.codePrefix}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
      requested_by: raisedBy.employeeId || null,
      requested_by_user_id: raisedBy.userId,
      current_level: 1,
      total_levels: group ? group.total_levels : 1,
      final_status: "PENDING",
      requested_at: clock.now(),
    },
    { transaction }
  );
  if (group) await openLevel(request, transaction);
  await notifyCurrentLevel(request, transaction);
  return request;
};

// The caller's employee record in their company, or null (the owner has none).
const employeeOf = (auth, transaction) =>
  Employee.findOne({ where: { user_id: auth.userId, employer_id: auth.employerId }, attributes: ["id", "full_name"], transaction });

const findRequest = async (employerId, id, transaction) => {
  const request = UUID.test(String(id))
    ? await ApprovalRequest.findOne({ where: { id, employer_id: employerId }, transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined })
    : null;
  if (!request) throw new ErrorHandler("NOT_FOUND");
  return request;
};

// D24: every mandatory approver who can act has approved; with none mandatory, any one has.
const levelComplete = async (request, transaction) => {
  const actors = await actorsAt(request, request.current_level, transaction);
  const approvedBy = new Set(
    (
      await ApprovalRequestLog.findAll({
        where: { approval_request_id: request.id, level_no: request.current_level, status: "APPROVED" },
        attributes: ["approval_group_member_id"],
        transaction,
      })
    ).map((l) => l.approval_group_member_id)
  );
  const mandatory = actors.filter((m) => m.is_mandatory);
  if (mandatory.length) return mandatory.every((m) => approvedBy.has(m.id));
  return approvedBy.size > 0;
};

// Moves a request whose current level is complete to the next level, or approves it (D23).
// `hooks.levelOpened` lets the edge rules skip a level with nobody left (11b).
const hooks = { levelOpened: [] };
const advance = async (request, transaction) => {
  if (request.current_level >= request.total_levels) {
    await request.update({ final_status: "APPROVED", completed_at: clock.now() }, { transaction });
    await entityOf(request.entity_type).onApproved(request, { transaction });
    return;
  }
  await request.update({ current_level: request.current_level + 1, final_status: "IN_PROGRESS" }, { transaction });
  await openLevel(request, transaction);
  for (const hook of hooks.levelOpened) await hook(request, transaction);
  if (PENDING.includes(request.final_status)) await notifyCurrentLevel(request, transaction);
};

// Writes an approver's decision on their log row for the level (the pending one, else a new one).
const writeDecision = async (request, member, status, comments, transaction) => {
  const row = await ApprovalRequestLog.findOne({
    where: { approval_request_id: request.id, approval_group_member_id: member.id, level_no: request.current_level },
    transaction,
  });
  const values = { status, comments: comments || null, acted_at: clock.now(), actor_user_id: member.employee.user_id };
  if (row) await row.update(values, { transaction });
  else {
    await ApprovalRequestLog.create(
      { approval_request_id: request.id, approval_group_member_id: member.id, employee_id: member.employee_id, level_no: request.current_level, ...values },
      { transaction }
    );
  }
};

// The member row through which the caller may act on the request's current level, or null.
const actingMember = async (auth, request, transaction) => {
  if (!request.approval_group_id) return null;
  const me = await employeeOf(auth, transaction);
  if (!me) return null;
  const actors = await actorsAt(request, request.current_level, transaction);
  return actors.find((m) => m.employee_id === me.id) || null;
};

// Extension point for the owner override (11b): (auth, request, decision, reason, transaction) →
// true when it handled the decision.
const decisionHooks = { beforeMember: [] };

// POST /approvals/:id/approve and /reject. `reason` is required (5–500) for a rejection.
const decide = async (auth, requestId, { decision, reason, comment }) => {
  await sequelize.transaction(async (transaction) => {
    const request = await findRequest(auth.employerId, requestId, transaction);
    if (!PENDING.includes(request.final_status)) throw new ErrorHandler("APPROVAL_ALREADY_DECIDED");
    for (const hook of decisionHooks.beforeMember) {
      if (await hook(auth, request, decision, reason, transaction)) return;
    }
    const member = await actingMember(auth, request, transaction);
    if (!member) throw new ErrorHandler("APPROVAL_NOT_YOUR_TURN");
    const already = await ApprovalRequestLog.count({
      where: { approval_request_id: request.id, approval_group_member_id: member.id, level_no: request.current_level, status: { [Op.ne]: "PENDING" } },
      transaction,
    });
    if (already) throw new ErrorHandler("APPROVAL_NOT_YOUR_TURN");

    if (decision === "REJECT") {
      await writeDecision(request, member, "REJECTED", reason, transaction);
      await reject(request, reason, transaction);
      return;
    }
    await writeDecision(request, member, "APPROVED", comment, transaction);
    if (await levelComplete(request, transaction)) await advance(request, transaction);
  });
  return { id: requestId };
};

// Ends a request as REJECTED with the reason (D25).
const reject = async (request, reason, transaction) => {
  await request.update({ final_status: "REJECTED", remarks: reason, completed_at: clock.now() }, { transaction });
  await entityOf(request.entity_type).onRejected(request, { transaction, reason });
};

// Cancels a pending request (the entity was withdrawn): it leaves every inbox; past logs stay.
const cancel = async (requestId, { transaction }) => {
  const request = await ApprovalRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!request || !PENDING.includes(request.final_status)) return;
  await request.update({ final_status: "CANCELLED", completed_at: clock.now() }, { transaction });
};

// Inbox rows for the caller. Extension point for blocked requests on the owner's inbox (11b).
const inboxHooks = { ownerExtra: [] };

const toInboxRow = (request, lang, subjects) => {
  const entity = entities.get(request.entity_type);
  const subject = subjects.get(request.subject_employee_id);
  return {
    id: request.id,
    request_code: request.request_code,
    entity_type: request.entity_type,
    entity_id: request.entity_id,
    type: entity ? entity.label[lang] || entity.label.en : request.entity_type,
    employee: subject ? { id: subject.id, name: subject.full_name, employee_code: subject.employee_code } : null,
    requested_at: request.requested_at,
    current_level: request.current_level,
    total_levels: request.total_levels,
    owner_only: !request.approval_group_id,
  };
};

// GET /approvals/inbox: pending requests waiting at the caller's level (D23); the owner also sees
// owner-only requests.
const inbox = async (auth, lang) => {
  const pending = await ApprovalRequest.findAll({
    where: { employer_id: auth.employerId, final_status: PENDING },
    order: [
      ["requested_at", "ASC"],
      ["id", "ASC"],
    ],
  });
  const me = await employeeOf(auth);
  const mine = [];
  for (const request of pending) {
    if (!request.approval_group_id) {
      if (auth.accessLevel === "ADMIN") mine.push(request);
      continue;
    }
    if (!me) continue;
    const member = (await actorsAt(request, request.current_level)).find((m) => m.employee_id === me.id);
    if (!member) continue;
    const acted = await ApprovalRequestLog.count({
      where: { approval_request_id: request.id, approval_group_member_id: member.id, level_no: request.current_level, status: { [Op.ne]: "PENDING" } },
    });
    if (!acted) mine.push(request);
  }
  if (auth.accessLevel === "ADMIN") {
    for (const hook of inboxHooks.ownerExtra) {
      for (const request of await hook(auth, pending)) if (!mine.includes(request)) mine.push(request);
    }
  }
  const subjects = new Map(
    (
      await Employee.findAll({
        where: { id: mine.map((r) => r.subject_employee_id).filter(Boolean) },
        attributes: ["id", "full_name", "employee_code"],
      })
    ).map((e) => [e.id, e])
  );
  return { items: mine.map((r) => toInboxRow(r, lang, subjects)), total: mine.length };
};

module.exports = {
  registerEntity,
  raise,
  decide,
  cancel,
  inbox,
  // For the edge rules (11b) and entities.
  rules,
  hooks,
  decisionHooks,
  inboxHooks,
  actorsAt,
  advance,
  reject,
  notifyCurrentLevel,
  employeeOf,
  PENDING,
};
