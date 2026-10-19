const { Op, UniqueConstraintError } = require("sequelize");
const { sequelize, Department, Designation, Employee } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");

// Departments (D31, D33, D36, D37). Always the caller's own company: the employer id
// comes from the access token, and another company's department answers 404.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Live designations of the row's department (soft-deleted ones don't count).
const DESIGNATION_COUNT = sequelize.literal(
  "(SELECT COUNT(*) FROM `hrms_designations` AS `d` WHERE `d`.`department_id` = `Department`.`id` AND `d`.`deleted_at` IS NULL)"
);

const ITEM_QUERY = {
  attributes: {
    include: [[DESIGNATION_COUNT, "designation_count"]],
  },
  // A deleted head shows as no head name (paranoid include); dept_head_id stays as stored.
  include: [{ model: Employee, as: "deptHead", attributes: ["full_name"], required: false }],
};

const toItem = (dept) => ({
  id: dept.id,
  name: dept.name,
  code: dept.code,
  description: dept.description ?? null,
  status: dept.status,
  dept_head_id: dept.dept_head_id ?? null,
  head_name: dept.deptHead ? dept.deptHead.full_name : null,
  designation_count: Number(dept.get("designation_count") || 0),
  created_at: dept.createdAt,
  updated_at: dept.updatedAt,
});

// The caller's live department, or 404 (also for a malformed id).
const findDepartment = async (employerId, id, options = {}) => {
  const dept = UUID.test(String(id))
    ? await Department.findOne({ where: { id, employer_id: employerId }, ...options })
    : null;
  if (!dept) throw new ErrorHandler("NOT_FOUND");
  return dept;
};

// LIKE pattern for a plain-text search: % and _ match themselves.
const likePattern = (term) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;

// Company-wide counts by status, whatever the list filters.
const companyStats = async (employerId) => {
  const rows = await Department.findAll({
    attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    where: { employer_id: employerId },
    group: ["status"],
    raw: true,
  });
  const byStatus = Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  const active = byStatus.ACTIVE || 0;
  const inactive = byStatus.INACTIVE || 0;
  return { total: active + inactive, active, inactive };
};

// GET /departments. Query is validated: { page, limit, search, status } ("" = no filter).
// Newest first, like the UI, which adds new departments at the top.
const listDepartments = async ({ employerId }, { page, limit, search, status }) => {
  const where = { employer_id: employerId };
  if (status) where.status = status;
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [{ name: { [Op.like]: pattern } }, { code: { [Op.like]: pattern } }];
  }

  const [total, rows, stats] = await Promise.all([
    Department.count({ where }),
    Department.findAll({
      ...ITEM_QUERY,
      where,
      order: [
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: (page - 1) * limit,
    }),
    companyStats(employerId),
  ]);

  return { items: rows.map(toItem), total, page, limit, stats };
};

// GET /departments/:id: the list item plus every non-deleted employee in it (any status).
const getDepartment = async ({ employerId }, id) => {
  const dept = await findDepartment(employerId, id, ITEM_QUERY);
  const totalEmployees = await Employee.count({ where: { employer_id: employerId, department_id: dept.id } });
  return { ...toItem(dept), total_employees: totalEmployees };
};

// The head must be a non-deleted, ACTIVE employee of this company.
const assertHeadUsable = async (employerId, deptHeadId) => {
  const head = await Employee.findOne({
    where: { id: deptHeadId, employer_id: employerId, employment_status: "ACTIVE" },
    attributes: ["id"],
  });
  if (!head) throw new ErrorHandler("VALIDATION_FAILED", { errors: { deptHeadId: "departmentHeadInvalid" } });
};

// Names and codes are unique per company among live rows, case-insensitively (the
// column collation compares that way). When both clash, the name is reported.
const assertUnique = async (employerId, { name, code }, exceptId) => {
  const scope = { employer_id: employerId };
  if (exceptId) scope.id = { [Op.ne]: exceptId };
  if (await Department.findOne({ where: { ...scope, name }, attributes: ["id"] })) {
    throw new ErrorHandler("DEPARTMENT_NAME_TAKEN");
  }
  if (await Department.findOne({ where: { ...scope, code }, attributes: ["id"] })) {
    throw new ErrorHandler("DEPARTMENT_CODE_TAKEN");
  }
};

// Two saves at once can both pass assertUnique; the unique keys (migration 103) still
// stop the second. Map that error by index name to the same codes.
const UNIQUE_KEY_CODES = {
  uq_hrms_departments_employer_id_name_live_key: "DEPARTMENT_NAME_TAKEN",
  uq_hrms_departments_employer_id_code_live_key: "DEPARTMENT_CODE_TAKEN",
};
const saveOrClash = async (save) => {
  try {
    return await save();
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const text = [err.original && err.original.message, ...Object.keys(err.fields || {})].join(" ");
      const index = Object.keys(UNIQUE_KEY_CODES).find((key) => text.includes(key));
      if (index) throw new ErrorHandler(UNIQUE_KEY_CODES[index]);
    }
    throw err;
  }
};

// "" and null both mean "none" for the optional fields.
const orNull = (value) => (value === "" || value === null ? null : value);

// POST /departments. Body is validated (trimmed, code uppercased).
const createDepartment = async ({ employerId, userId }, body) => {
  const deptHeadId = orNull(body.deptHeadId ?? null);
  if (deptHeadId) await assertHeadUsable(employerId, deptHeadId);
  await assertUnique(employerId, body);

  const dept = await saveOrClash(() =>
    Department.create({
      employer_id: employerId,
      name: body.name,
      code: body.code,
      description: orNull(body.description ?? null),
      status: body.status || "ACTIVE",
      dept_head_id: deptHeadId,
      created_by: userId,
      updated_by: userId,
    })
  );
  return getDepartment({ employerId }, dept.id);
};

// PUT /departments/:id. name and code always; omitted optional fields keep their values.
const updateDepartment = async ({ employerId, userId }, id, body) => {
  const dept = await findDepartment(employerId, id);

  const changes = { name: body.name, code: body.code, updated_by: userId };
  if (body.description !== undefined) changes.description = orNull(body.description);
  if (body.status !== undefined) changes.status = body.status;
  if (body.deptHeadId !== undefined) {
    changes.dept_head_id = orNull(body.deptHeadId);
    if (changes.dept_head_id) await assertHeadUsable(employerId, changes.dept_head_id);
  }
  await assertUnique(employerId, body, dept.id);

  await saveOrClash(() => dept.update(changes));
  return getDepartment({ employerId }, dept.id);
};

// DELETE /departments/:id. Blocked while any non-deleted employee (even an exited one)
// points at the department or at one of its designations. Otherwise its designations
// are soft-deleted with it, in one transaction; the names and codes become reusable.
const deleteDepartment = async ({ employerId, userId }, id) =>
  sequelize.transaction(async (transaction) => {
    const dept = await findDepartment(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });

    const designationIds = (
      await Designation.findAll({
        where: { employer_id: employerId, department_id: dept.id },
        attributes: ["id"],
        paranoid: false,
        transaction,
      })
    ).map((designation) => designation.id);

    const links = [{ department_id: dept.id }];
    if (designationIds.length) links.push({ designation_id: { [Op.in]: designationIds } });
    const linked = await Employee.count({ where: { employer_id: employerId, [Op.or]: links }, transaction });
    if (linked > 0) throw new ErrorHandler("DEPARTMENT_IN_USE");

    await Designation.destroy({ where: { employer_id: employerId, department_id: dept.id }, transaction });
    await dept.update({ updated_by: userId }, { transaction });
    await dept.destroy({ transaction });
    return { id: dept.id };
  });

module.exports = { listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment };
