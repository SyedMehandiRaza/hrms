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
const approvalGroups = require("./approvalGroup.service");

// The approval engine (docs/plans/workforce-and-lifecycle.md D18, D22a, D23–D29, ADR 0011). Any
// entity (exit first) registers itself and sends requests through the subject employee's approval
// group: levels approve in order; at a level every mandatory approver must approve, or any one when
// none is mandatory; any rejection ends the request. The group is frozen on the request, its members
// are read live. An employee with no group gets an owner-only request.
//
// Edge rules (D26, D27): the subject and the raiser never act on the request; EXITED approvers drop
// out (IN_NOTICE ones still act). A level left with nobody who can act is SKIPPED when every
// approver on it is marked Can skip, otherwise it blocks and shows on the owner's inbox. The owner
// can approve or reject the current level on anyone's behalf with a reason (an override).

const PENDING = ["PENDING", "IN_PROGRESS"];
const MODULE_ALL = "ALL";
const ACTIVE_APPROVER = ["ACTIVE", "IN_NOTICE"];

// entityType → { moduleKey, label: { en, ar }, codePrefix, approvalTemplate, onApproved, onRejected }
const entities = new Map();
const registerEntity = (entityType, definition) => entities.set(entityType, definition);
const entityOf = (entityType) => {
  const entity = entities.get(entityType);
  if (!entity) throw new Error(`approval: unknown entity type ${entityType}`);
  return entity;
};

const membersAt = (groupId, level, transaction) =>
  ApprovalGroupMember.findAll({
    where: { approval_group_id: groupId, level_no: level },
    include: [{ model: Employee, as: "employee", attributes: ["id", "user_id", "full_name", "employment_status"], required: true }],
    transaction,
  });

// Who may act on the request at a member row, read live (D26, D28).
const canAct = (member, request) =>
  member.is_active &&
  ACTIVE_APPROVER.includes(member.employee.employment_status) &&
  member.employee_id !== request.subject_employee_id &&
  member.employee_id !== request.requested_by;

const actorsAt = async (request, level, transaction) =>
  (await membersAt(request.approval_group_id, level, transaction)).filter((m) => canAct(m, request));

// D26 (decided 2026-10-21): a level is skippable when every approver on it — current members and
// members who exited — is marked Can skip.
const skippable = async (request, level, transaction) => {
  const approvers = (await membersAt(request.approval_group_id, level, transaction)).filter(
    (m) => m.is_active || m.employee.employment_status === "EXITED"
  );
  return approvers.length > 0 && approvers.every((m) => m.can_skip);
};

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

// The "needs your approval" emails to the people who can act at the request's current level (the
// owner for an owner-only request).
const notifyCurrentLevel = async (request, transaction) => {
  const entity = entityOf(request.entity_type);
  if (!entity.approvalTemplate) return;
  const employeeName = await subjectName(request, transaction);
  let userIds;
  if (request.approval_group_id) {
    userIds = (await actorsAt(request, request.current_level, transaction)).map((m) => m.employee.user_id);
  } else {
    userIds = [(await Employer.findByPk(request.employer_id, { attributes: ["user_id"], transaction })).user_id];
  }
  const users = await User.findAll({ where: { id: userIds }, attributes: ["email", "lang_key"], transaction });
  queueMails(
    transaction,
    users.map((u) => ({ to: u.email, lang: u.lang_key, template: entity.approvalTemplate, data: { employeeName } }))
  );
};

const log = (request, values, transaction) =>
  ApprovalRequestLog.create({ approval_request_id: request.id, level_no: request.current_level, ...values }, { transaction });

// Pending log rows for the people who can act at the request's current level.
const openLevel = async (request, transaction) => {
  for (const m of await actorsAt(request, request.current_level, transaction)) {
    await log(request, { approval_group_member_id: m.id, employee_id: m.employee_id, status: "PENDING" }, transaction);
  }
};

const approveRequest = async (request, transaction) => {
  await request.update({ final_status: "APPROVED", completed_at: clock.now() }, { transaction });
  await entityOf(request.entity_type).onApproved(request, { transaction });
};

// From the current level: while nobody can act, skip it (if skippable) or stop there (blocked).
// When the last level is skipped the request is approved. Notifies the level it stops at.
const settle = async (request, transaction) => {
  while (PENDING.includes(request.final_status)) {
    if ((await actorsAt(request, request.current_level, transaction)).length) {
      await notifyCurrentLevel(request, transaction);
      return;
    }
    if (!(await skippable(request, request.current_level, transaction))) return; // blocked: the owner decides
    await log(request, { status: "SKIPPED", acted_at: clock.now() }, transaction);
    if (request.current_level >= request.total_levels) {
      await approveRequest(request, transaction);
      return;
    }
    await request.update({ current_level: request.current_level + 1, final_status: "IN_PROGRESS" }, { transaction });
    await openLevel(request, transaction);
  }
};

// Moves a request whose current level is done to the next level, or approves it (D23).
const advance = async (request, transaction) => {
  if (request.current_level >= request.total_levels) {
    await approveRequest(request, transaction);
    return;
  }
  await request.update({ current_level: request.current_level + 1, final_status: "IN_PROGRESS" }, { transaction });
  await openLevel(request, transaction);
  await settle(request, transaction);
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
  if (group) {
    await openLevel(request, transaction);
    await settle(request, transaction);
  } else {
    await notifyCurrentLevel(request, transaction);
  }
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
  return actors.some((m) => approvedBy.has(m.id));
};

// Writes an approver's decision on their log row for the level (the pending one, else a new one).
const writeDecision = async (request, member, status, comments, transaction) => {
  const row = await ApprovalRequestLog.findOne({
    where: { approval_request_id: request.id, approval_group_member_id: member.id, level_no: request.current_level },
    transaction,
  });
  const values = { status, comments: comments || null, acted_at: clock.now(), actor_user_id: member.employee.user_id };
  if (row) await row.update(values, { transaction });
  else await log(request, { approval_group_member_id: member.id, employee_id: member.employee_id, ...values }, transaction);
};

// Ends a request as REJECTED with the reason (D25).
const rejectRequest = async (request, reason, transaction) => {
  await request.update({ final_status: "REJECTED", remarks: reason, completed_at: clock.now() }, { transaction });
  await entityOf(request.entity_type).onRejected(request, { transaction, reason });
};

const validReason = (reason) => typeof reason === "string" && reason.trim().length >= 5 && reason.trim().length <= 500;

// D27: the owner approves or rejects the current level on anyone's behalf, with a reason.
const override = async (auth, request, decision, reason, transaction) => {
  if (!validReason(reason)) throw new ErrorHandler("VALIDATION_FAILED", { errors: { reason: "reason5to500" } });
  const status = decision === "REJECT" ? "REJECTED" : "APPROVED";
  await log(request, { status, comments: reason.trim(), acted_at: clock.now(), actor_user_id: auth.userId, is_override: true }, transaction);
  if (status === "REJECTED") await rejectRequest(request, reason.trim(), transaction);
  else await advance(request, transaction);
};

// POST /approvals/:id/approve and /reject. A rejection needs a reason (5–500).
const decide = async (auth, requestId, { decision, reason, comment }) => {
  await sequelize.transaction(async (transaction) => {
    const request = await findRequest(auth.employerId, requestId, transaction);
    if (!PENDING.includes(request.final_status)) throw new ErrorHandler("APPROVAL_ALREADY_DECIDED");

    const me = await employeeOf(auth, transaction);
    const member =
      me && request.approval_group_id ? (await actorsAt(request, request.current_level, transaction)).find((m) => m.employee_id === me.id) : null;
    const acted =
      member &&
      (await ApprovalRequestLog.count({
        where: { approval_request_id: request.id, approval_group_member_id: member.id, level_no: request.current_level, status: { [Op.ne]: "PENDING" } },
        transaction,
      }));

    if (!member || acted) {
      if (auth.accessLevel === "ADMIN") {
        await override(auth, request, decision, reason, transaction);
        return;
      }
      // An approver of a level that was decided while they were deciding → already decided.
      const passedLevel =
        me && request.approval_group_id
          ? await ApprovalGroupMember.count({
              where: { approval_group_id: request.approval_group_id, employee_id: me.id, level_no: { [Op.lt]: request.current_level } },
              transaction,
            })
          : 0;
      throw new ErrorHandler(passedLevel || acted ? "APPROVAL_ALREADY_DECIDED" : "APPROVAL_NOT_YOUR_TURN");
    }

    if (decision === "REJECT") {
      await writeDecision(request, member, "REJECTED", reason, transaction);
      await rejectRequest(request, reason, transaction);
      return;
    }
    await writeDecision(request, member, "APPROVED", comment, transaction);
    if (await levelComplete(request, transaction)) await advance(request, transaction);
  });
  return { id: requestId };
};

// Cancels a pending request (the entity was withdrawn): it leaves every inbox; past logs stay.
const cancel = async (requestId, { transaction }) => {
  const request = await ApprovalRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!request || !PENDING.includes(request.final_status)) return;
  await request.update({ final_status: "CANCELLED", completed_at: clock.now() }, { transaction });
};

// Re-checks a pending request after its group or an approver changed (D22a, D63): a level left
// with nobody skips or blocks, a level now complete moves on.
const reevaluate = async (request, transaction) => {
  if (!request.approval_group_id || !PENDING.includes(request.final_status)) return;
  if (!(await actorsAt(request, request.current_level, transaction)).length) await settle(request, transaction);
  else if (await levelComplete(request, transaction)) await advance(request, transaction);
};

const pendingOfGroup = (groupId, transaction) =>
  ApprovalRequest.findAll({ where: { approval_group_id: groupId, final_status: PENDING }, transaction, lock: transaction.LOCK.UPDATE });

const reevaluateGroup = async (groupId, transaction) => {
  for (const request of await pendingOfGroup(groupId, transaction)) await reevaluate(request, transaction);
};

// D22a: a members change may not remove a level that a pending request is at or still needs.
approvalGroups.membersHooks.before.push(async (group, members, transaction) => {
  const needed = Math.max(0, ...(await pendingOfGroup(group.id, transaction)).map((r) => r.total_levels));
  if (Math.max(...members.map((m) => m.level)) < needed) throw new ErrorHandler("APPROVAL_GROUP_HAS_PENDING");
});
approvalGroups.membersHooks.after.push((group, transaction) => reevaluateGroup(group.id, transaction));

const toInboxRow = (request, lang, subjects, blocked) => {
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
    blocked,
  };
};

// GET /approvals/inbox: pending requests waiting at the caller's level (D23). The owner also sees
// owner-only requests and blocked ones (nobody left who can act at the current level).
const inbox = async (auth, lang) => {
  const pending = await ApprovalRequest.findAll({
    where: { employer_id: auth.employerId, final_status: PENDING },
    order: [
      ["requested_at", "ASC"],
      ["id", "ASC"],
    ],
  });
  const me = await employeeOf(auth);
  const isOwner = auth.accessLevel === "ADMIN";
  const rows = [];
  for (const request of pending) {
    if (!request.approval_group_id) {
      if (isOwner) rows.push([request, false]);
      continue;
    }
    const actors = await actorsAt(request, request.current_level);
    if (!actors.length) {
      if (isOwner) rows.push([request, true]);
      continue;
    }
    const member = me && actors.find((m) => m.employee_id === me.id);
    if (!member) continue;
    const acted = await ApprovalRequestLog.count({
      where: { approval_request_id: request.id, approval_group_member_id: member.id, level_no: request.current_level, status: { [Op.ne]: "PENDING" } },
    });
    if (!acted) rows.push([request, false]);
  }
  const subjects = new Map(
    (
      await Employee.findAll({
        where: { id: rows.map(([r]) => r.subject_employee_id).filter(Boolean) },
        attributes: ["id", "full_name", "employee_code"],
      })
    ).map((e) => [e.id, e])
  );
  return { items: rows.map(([r, blocked]) => toInboxRow(r, lang, subjects, blocked)), total: rows.length };
};

module.exports = {
  registerEntity,
  raise,
  decide,
  cancel,
  inbox,
  reevaluate,
  reevaluateGroup,
  employeeOf,
  PENDING,
};
