const { Op } = require("sequelize");
const {
  sequelize,
  ApprovalGroup,
  ApprovalGroupMember,
  ApprovalRequest,
  Employee,
  EmployeeProject,
  EmployeeApprovalRouting,
  Project,
} = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { saveOrClash } = require("../utils/uniqueClash");
const { UUID, likePattern, orNull } = require("./department.service");

// Approval groups (docs/plans/workforce-and-lifecycle.md D17–D22, ADR 0011). Always the caller's
// own company. Groups are never deleted ("Deactivate" sets is_active = false). A removed
// approver's member row is deactivated, not deleted: past request logs point at it.

const MODULE_ALL = "ALL";
const PENDING = ["PENDING", "IN_PROGRESS"];
const APPROVER_STATUSES = ["ACTIVE", "IN_NOTICE"];

const membersOf = (groupIds, transaction) =>
  ApprovalGroupMember.findAll({
    where: { approval_group_id: groupIds },
    include: [{ model: Employee, as: "employee", attributes: ["id", "full_name", "employee_code", "employment_status"], required: false }],
    order: [
      ["level_no", "ASC"],
      ["created_at", "ASC"],
    ],
    transaction,
  });

const isActiveApprover = (m) => m.is_active && m.employee && APPROVER_STATUSES.includes(m.employee.employment_status);

// D22: levels 1…total_levels with no active approver left ("Level n has no active approver.").
const emptyLevels = (group, members) => {
  const out = [];
  for (let level = 1; level <= group.total_levels; level += 1) {
    if (!members.some((m) => m.level_no === level && isActiveApprover(m))) out.push(level);
  }
  return out;
};

const toItem = (group, members, { withMembers = false } = {}) => {
  const current = members.filter((m) => m.is_active);
  const item = {
    id: group.id,
    name: group.group_name,
    code: group.group_code,
    module: group.module_key,
    description: group.description ?? null,
    scope: group.scope,
    project: group.project ? { id: group.project.id, name: group.project.project_name, code: group.project.project_code } : null,
    total_levels: group.total_levels,
    approver_count: current.length,
    status: group.is_active ? "ACTIVE" : "INACTIVE",
    levels_without_active_approver: emptyLevels(group, members),
    created_at: group.createdAt,
    updated_at: group.updatedAt,
  };
  if (withMembers) {
    item.members = current.map((m) => ({
      id: m.id,
      employee_id: m.employee_id,
      name: m.employee ? m.employee.full_name : null,
      employee_code: m.employee ? m.employee.employee_code : null,
      employment_status: m.employee ? m.employee.employment_status : null,
      level: m.level_no,
      is_mandatory: Boolean(m.is_mandatory),
      can_skip: Boolean(m.can_skip),
    }));
  }
  return item;
};

const PROJECT_INCLUDE = { model: Project, as: "project", attributes: ["id", "project_name", "project_code"], required: false };

// The caller's group, or 404 (also for a malformed id).
const findGroup = async (employerId, id, options = {}) => {
  const group = UUID.test(String(id)) ? await ApprovalGroup.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!group) throw new ErrorHandler("NOT_FOUND");
  return group;
};

// GET /approval-groups?search=&status=&page=&limit= (newest first).
const listGroups = async ({ employerId }, { page, limit, search, status }) => {
  const where = { employer_id: employerId };
  if (status) where.is_active = status === "ACTIVE";
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [{ group_name: { [Op.like]: pattern } }, { group_code: { [Op.like]: pattern } }];
  }
  const { count, rows } = await ApprovalGroup.findAndCountAll({
    where,
    include: [PROJECT_INCLUDE],
    order: [
      ["createdAt", "DESC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  const members = await membersOf(rows.map((g) => g.id));
  return { items: rows.map((g) => toItem(g, members.filter((m) => m.approval_group_id === g.id))), total: count, page, limit };
};

// GET /approval-groups/:id (with its current members).
const getGroup = async ({ employerId }, id, { transaction } = {}) => {
  const group = await findGroup(employerId, id, { include: [PROJECT_INCLUDE], transaction });
  return toItem(group, await membersOf([group.id], transaction), { withMembers: true });
};

// GET /approval-groups/approver-options: ACTIVE and IN_NOTICE employees who can be approvers
// (with whether they're on the given project, for PROJECT groups).
const approverOptions = async ({ employerId }, { page, limit, search, projectId }) => {
  const where = { employer_id: employerId, employment_status: APPROVER_STATUSES };
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [{ full_name: { [Op.like]: pattern } }, { employee_code: { [Op.like]: pattern } }];
  }
  const { count, rows } = await Employee.findAndCountAll({
    where,
    attributes: ["id", "full_name", "employee_code", "employment_status"],
    order: [
      ["full_name", "ASC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  const onProject = new Set();
  if (projectId && UUID.test(projectId) && rows.length) {
    const assigned = await EmployeeProject.findAll({
      where: { project_id: projectId, employer_id: employerId, employee_id: rows.map((e) => e.id), is_active: true },
      attributes: ["employee_id"],
    });
    assigned.forEach((a) => onProject.add(a.employee_id));
  }
  return {
    items: rows.map((e) => ({
      id: e.id,
      name: e.full_name,
      employee_code: e.employee_code,
      employment_status: e.employment_status,
      on_project: onProject.has(e.id),
    })),
    total: count,
    page,
    limit,
  };
};

const UNIQUE_KEY_CODES = {
  uq_hrms_approval_groups_employer_id_group_name: "APPROVAL_GROUP_NAME_TAKEN",
  uq_hrms_approval_groups_employer_id_group_code: "APPROVAL_GROUP_CODE_TAKEN",
};

// Names (inactive groups included) and codes are unique per company; the name is reported first.
const assertUnique = async (employerId, { name, code }, exceptId, transaction) => {
  const scope = { employer_id: employerId };
  if (exceptId) scope.id = { [Op.ne]: exceptId };
  if (await ApprovalGroup.findOne({ where: { ...scope, group_name: name }, attributes: ["id"], transaction })) {
    throw new ErrorHandler("APPROVAL_GROUP_NAME_TAKEN");
  }
  if (await ApprovalGroup.findOne({ where: { ...scope, group_code: code }, attributes: ["id"], transaction })) {
    throw new ErrorHandler("APPROVAL_GROUP_CODE_TAKEN");
  }
};

const fieldError = (field, key) => new ErrorHandler("VALIDATION_FAILED", { errors: { [field]: key } });

// The project of a PROJECT group must be the company's (D20).
const checkScope = async (employerId, body, transaction) => {
  if (body.moduleKey !== MODULE_ALL) throw new ErrorHandler("APPROVAL_ROUTING_PER_MODULE_DISABLED");
  if (body.scope !== "PROJECT") return null;
  const project = UUID.test(String(body.projectId))
    ? await Project.findOne({ where: { id: body.projectId, employer_id: employerId }, attributes: ["id"], transaction })
    : null;
  if (!project) throw fieldError("projectId", "projectSelect");
  return project.id;
};

// Every approver is an ACTIVE or IN_NOTICE employee of the company (D21); a PROJECT group needs
// at least one of them on its project (D20).
const checkMembers = async (employerId, members, projectId, transaction) => {
  const ids = members.map((m) => m.employeeId);
  if (!ids.every((id) => UUID.test(id))) throw fieldError("members", "departmentHeadInvalid");
  const employees = await Employee.findAll({
    where: { id: ids, employer_id: employerId, employment_status: APPROVER_STATUSES },
    attributes: ["id"],
    transaction,
  });
  if (employees.length !== ids.length) throw fieldError("members", "departmentHeadInvalid");
  if (projectId) {
    const onProject = await EmployeeProject.count({ where: { project_id: projectId, employee_id: ids, is_active: true }, transaction });
    if (!onProject) throw fieldError("members", "projectApproverRequired");
  }
};

// Makes the group's current members exactly `members`: existing rows (by employee) get the new
// level and flags, new approvers get a row, the others are deactivated.
const writeMembers = async (group, members, transaction) => {
  const existing = await ApprovalGroupMember.findAll({ where: { approval_group_id: group.id }, transaction });
  const byEmployee = new Map();
  existing.forEach((row) => {
    if (!byEmployee.has(row.employee_id) || row.is_active) byEmployee.set(row.employee_id, row);
  });
  const keep = new Set();
  for (const m of members) {
    const values = { level_no: m.level, is_mandatory: m.isMandatory, can_skip: m.canSkip, is_active: true };
    const row = byEmployee.get(m.employeeId);
    if (row) {
      await row.update(values, { transaction });
      keep.add(row.id);
    } else {
      const created = await ApprovalGroupMember.create({ approval_group_id: group.id, employee_id: m.employeeId, ...values }, { transaction });
      keep.add(created.id);
    }
  }
  for (const row of existing) {
    if (!keep.has(row.id) && row.is_active) await row.update({ is_active: false }, { transaction });
  }
  await group.update({ total_levels: Math.max(...members.map((m) => m.level)) }, { transaction });
};

// POST /approval-groups
const createGroup = async ({ employerId, userId }, body) => {
  const id = await sequelize.transaction(async (transaction) => {
    const projectId = await checkScope(employerId, body, transaction);
    await assertUnique(employerId, body, null, transaction);
    await checkMembers(employerId, body.members, projectId, transaction);
    const group = await saveOrClash(
      () =>
        ApprovalGroup.create(
          {
            employer_id: employerId,
            group_name: body.name,
            group_code: body.code,
            module_key: MODULE_ALL,
            scope: body.scope,
            project_id: projectId,
            description: orNull(body.description ?? null),
            created_by: userId,
          },
          { transaction }
        ),
      UNIQUE_KEY_CODES
    );
    await writeMembers(group, body.members, transaction);
    return group.id;
  });
  return getGroup({ employerId }, id);
};

// PUT /approval-groups/:id: name, code, description, scope and project. A PROJECT group still
// needs an approver on its project.
const updateGroup = async ({ employerId }, id, body) => {
  await sequelize.transaction(async (transaction) => {
    const group = await findGroup(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    const projectId = await checkScope(employerId, body, transaction);
    await assertUnique(employerId, body, group.id, transaction);
    if (projectId) {
      const current = (await ApprovalGroupMember.findAll({ where: { approval_group_id: group.id, is_active: true }, transaction })).map((m) => ({
        employeeId: m.employee_id,
      }));
      const onProject = await EmployeeProject.count({
        where: { project_id: projectId, employee_id: current.map((m) => m.employeeId), is_active: true },
        transaction,
      });
      if (!onProject) throw fieldError("members", "projectApproverRequired");
    }
    const changes = { group_name: body.name, group_code: body.code, scope: body.scope, project_id: projectId };
    if (body.description !== undefined) changes.description = orNull(body.description);
    await saveOrClash(() => group.update(changes, { transaction }), UNIQUE_KEY_CODES);
  });
  return getGroup({ employerId }, id);
};

// PUT /approval-groups/:id/members. Hooks run inside the transaction once the members are
// written (the approval engine re-evaluates pending requests there, D22a).
const membersHooks = { before: [], after: [] };
const updateMembers = async ({ employerId }, id, { members }) => {
  await sequelize.transaction(async (transaction) => {
    const group = await findGroup(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    await checkMembers(employerId, members, group.scope === "PROJECT" ? group.project_id : null, transaction);
    for (const hook of membersHooks.before) await hook(group, members, transaction);
    await writeMembers(group, members, transaction);
    for (const hook of membersHooks.after) await hook(group, transaction);
  });
  return getGroup({ employerId }, id);
};

// PATCH /approval-groups/:id/status. Deactivating a group routed to any non-exited employee or
// with pending requests → APPROVAL_GROUP_IN_USE (D22). Activating again is always allowed.
const changeStatus = async ({ employerId }, id, { status }) => {
  await sequelize.transaction(async (transaction) => {
    const group = await findGroup(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (status === "INACTIVE" && group.is_active) {
      const routed = await EmployeeApprovalRouting.count({
        where: { approval_group_id: group.id },
        include: [{ model: Employee, as: "employee", where: { employment_status: { [Op.ne]: "EXITED" } }, required: true }],
        transaction,
      });
      const pending = await ApprovalRequest.count({ where: { approval_group_id: group.id, final_status: PENDING }, transaction });
      if (routed || pending) throw new ErrorHandler("APPROVAL_GROUP_IN_USE");
    }
    await group.update({ is_active: status === "ACTIVE" }, { transaction });
  });
  return getGroup({ employerId }, id);
};

module.exports = {
  listGroups,
  getGroup,
  approverOptions,
  createGroup,
  updateGroup,
  updateMembers,
  changeStatus,
  // Shared with the approval engine and employees.
  findGroup,
  membersHooks,
  emptyLevels,
  isActiveApprover,
  PENDING,
};
