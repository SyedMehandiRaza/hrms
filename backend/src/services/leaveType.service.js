const { Op } = require("sequelize");
const { sequelize, LeaveType, LeavePolicy, EmployeeLeavePolicy } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { saveOrClash } = require("../utils/uniqueClash");
const { UUID, likePattern, orNull } = require("./department.service");
const { companyToday, financialYearOn } = require("./companyTime.service");

// Leave types and their one policy (docs/plans/workforce-and-lifecycle.md D30–D32). Always the
// caller's own company. No versioning: an edit changes the policy in place (future accruals only).
// Inactive = not newly assignable; delete only if the policy was never assigned.

const num = (value) => (value === null || value === undefined ? null : Number(value));

const ITEM_QUERY = {
  include: [{ model: LeavePolicy, as: "leavePolicies", required: false }],
  attributes: {
    include: [
      [
        sequelize.literal(
          "(SELECT COUNT(DISTINCT elp.employee_id) FROM `hrms_employee_leave_policies` elp JOIN `hrms_leave_policies` lp ON lp.id = elp.leave_policy_id " +
            "WHERE lp.leave_type_id = `LeaveType`.`id` AND elp.is_active = 1)"
        ),
        "assigned_employees",
      ],
    ],
  },
};

const toItem = (type) => {
  const p = (type.leavePolicies || [])[0] || {};
  return {
    id: type.id,
    name: type.leave_name,
    code: type.leave_code,
    description: type.description ?? null,
    is_paid: Boolean(type.is_paid),
    allow_half_day: Boolean(type.allow_half_day),
    requires_document: Boolean(type.requires_document),
    is_active: Boolean(type.is_active),
    policy_id: p.id || null,
    yearly_quota: num(p.yearly_quota),
    accrual_method: p.accrual_method || null,
    monthly_accrual: num(p.monthly_accrual),
    effective_from: p.effective_from || null,
    effective_to: p.effective_to || null,
    allow_carry_forward: Boolean(p.allow_carry_forward),
    max_carry_forward_days: num(p.max_carry_forward_days),
    carry_forward_expiry_months: p.carry_forward_expiry_months ?? 0,
    allow_encashment: Boolean(p.allow_encashment),
    max_encashment_days: num(p.max_encashment_days),
    year_end_excess: p.year_end_excess || null,
    allow_negative_balance: Boolean(p.allow_negative_balance),
    prorate_joiners: Boolean(p.prorate_joiners),
    assigned_employees: Number(type.get("assigned_employees") || 0),
    created_at: type.createdAt,
    updated_at: type.updatedAt,
  };
};

// The caller's leave type, or 404 (also for a malformed id).
const findLeaveType = async (employerId, id, options = {}) => {
  const type = UUID.test(String(id)) ? await LeaveType.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!type) throw new ErrorHandler("NOT_FOUND");
  return type;
};

// GET /leave-types?search=&status=&page=&limit= (by name).
const listLeaveTypes = async ({ employerId }, { page, limit, search, status }) => {
  const where = { employer_id: employerId };
  if (status) where.is_active = status === "ACTIVE";
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [{ leave_name: { [Op.like]: pattern } }, { leave_code: { [Op.like]: pattern } }];
  }
  const total = await LeaveType.count({ where });
  const rows = await LeaveType.findAll({
    ...ITEM_QUERY,
    where,
    order: [
      ["leave_name", "ASC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: rows.map(toItem), total, page, limit };
};

const getLeaveType = async ({ employerId }, id) => toItem(await findLeaveType(employerId, id, ITEM_QUERY));

const UNIQUE_KEY_CODES = {
  uq_hrms_leave_types_employer_id_leave_name: "LEAVE_TYPE_NAME_TAKEN",
  uq_hrms_leave_types_employer_id_leave_code: "LEAVE_TYPE_CODE_TAKEN",
};

// Names and codes are unique per company, case-insensitively; the name is reported first.
const assertUnique = async (employerId, { name, code }, exceptId, transaction) => {
  const scope = { employer_id: employerId };
  if (exceptId) scope.id = { [Op.ne]: exceptId };
  if (await LeaveType.findOne({ where: { ...scope, leave_name: name }, attributes: ["id"], transaction })) {
    throw new ErrorHandler("LEAVE_TYPE_NAME_TAKEN");
  }
  if (await LeaveType.findOne({ where: { ...scope, leave_code: code }, attributes: ["id"], transaction })) {
    throw new ErrorHandler("LEAVE_TYPE_CODE_TAKEN");
  }
};

const typeColumns = (b) => ({
  leave_name: b.name,
  leave_code: b.code,
  description: orNull(b.description ?? null),
  is_paid: b.is_paid,
  allow_half_day: b.allow_half_day,
  requires_document: b.requires_document,
  is_active: b.is_active,
});

// Monthly accrual is ignored for UPFRONT; effective-from defaults to the current FY's start.
const policyColumns = async (employerId, b, transaction) => {
  let from = orNull(b.effective_from ?? null);
  if (!from) {
    const today = await companyToday(employerId, { transaction });
    const fy = await financialYearOn(employerId, today, { transaction });
    from = fy ? fy.start_date : today;
  }
  return {
    policy_name: b.name,
    yearly_quota: b.yearly_quota,
    accrual_method: b.accrual_method,
    monthly_accrual: b.accrual_method === "UPFRONT" ? 0 : b.monthly_accrual,
    effective_from: from,
    effective_to: orNull(b.effective_to ?? null),
    allow_carry_forward: b.allow_carry_forward,
    max_carry_forward_days: b.allow_carry_forward ? b.max_carry_forward_days : 0,
    carry_forward_expiry_months: b.carry_forward_expiry_months,
    allow_encashment: b.allow_encashment,
    max_encashment_days: b.allow_encashment ? b.max_encashment_days : 0,
    year_end_excess: b.year_end_excess,
    allow_negative_balance: b.allow_negative_balance,
    prorate_joiners: b.prorate_joiners,
    is_active: b.is_active,
  };
};

// POST /leave-types: the type and its one policy.
const createLeaveType = async ({ employerId }, body) => {
  const id = await sequelize.transaction(async (transaction) => {
    await assertUnique(employerId, body, null, transaction);
    const type = await saveOrClash(
      () => LeaveType.create({ employer_id: employerId, ...typeColumns(body) }, { transaction }),
      UNIQUE_KEY_CODES
    );
    await LeavePolicy.create({ employer_id: employerId, leave_type_id: type.id, ...(await policyColumns(employerId, body, transaction)) }, { transaction });
    return type.id;
  });
  return getLeaveType({ employerId }, id);
};

// PUT /leave-types/:id: the type and its policy change in place (no versions, D30).
const updateLeaveType = async ({ employerId }, id, body) => {
  await sequelize.transaction(async (transaction) => {
    const type = await findLeaveType(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    await assertUnique(employerId, body, type.id, transaction);
    await saveOrClash(() => type.update(typeColumns(body), { transaction }), UNIQUE_KEY_CODES);
    const columns = await policyColumns(employerId, body, transaction);
    const policy = await LeavePolicy.findOne({ where: { leave_type_id: type.id }, transaction });
    if (policy) await policy.update(columns, { transaction });
    else await LeavePolicy.create({ employer_id: employerId, leave_type_id: type.id, ...columns }, { transaction });
  });
  return getLeaveType({ employerId }, id);
};

// DELETE /leave-types/:id. Blocked if its policy was ever assigned (even if that ended, D32).
const deleteLeaveType = async ({ employerId }, id) =>
  sequelize.transaction(async (transaction) => {
    const type = await findLeaveType(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    const policies = await LeavePolicy.findAll({ where: { leave_type_id: type.id }, paranoid: false, attributes: ["id"], transaction });
    const everAssigned = await EmployeeLeavePolicy.count({ where: { leave_policy_id: policies.map((p) => p.id) }, transaction });
    if (everAssigned) throw new ErrorHandler("LEAVE_TYPE_IN_USE");
    await LeavePolicy.destroy({ where: { leave_type_id: type.id }, force: true, transaction });
    await type.destroy({ transaction });
    return { id: type.id };
  });

// POST /leave-types/:id/versions: not available yet (D30).
const createVersion = async ({ employerId }, id) => {
  await findLeaveType(employerId, id, { attributes: ["id"] });
  throw new ErrorHandler("LEAVE_POLICY_VERSIONING_DISABLED");
};

module.exports = { listLeaveTypes, getLeaveType, createLeaveType, updateLeaveType, deleteLeaveType, createVersion, findLeaveType };
