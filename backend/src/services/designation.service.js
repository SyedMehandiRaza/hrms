const { Op } = require("sequelize");
const { sequelize, Department, Designation, Employee } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { saveOrClash } = require("../utils/uniqueClash");
const { findDepartment, likePattern, orNull, UUID } = require("./department.service");

// Designations (D32, D33, D37). Always the caller's own company: the employer id comes
// from the access token, and another company's department or designation answers 404.

// Non-deleted employees (any status) holding the row's designation.
const EMPLOYEE_COUNT = sequelize.literal(
  "(SELECT COUNT(*) FROM `employees` AS `e` WHERE `e`.`designation_id` = `Designation`.`id` AND `e`.`deleted_at` IS NULL)"
);
const ITEM_ATTRIBUTES = { include: [[EMPLOYEE_COUNT, "employee_count"]] };

const toItem = (desig) => ({
  id: desig.id,
  department_id: desig.department_id,
  name: desig.name,
  code: desig.code ?? null,
  description: desig.description ?? null,
  status: desig.status,
  employee_count: Number(desig.get("employee_count") || 0),
  created_at: desig.createdAt,
  updated_at: desig.updatedAt,
});

const getItem = async (employerId, id) => {
  const [desig] = await Designation.findAll({ attributes: ITEM_ATTRIBUTES, where: { id, employer_id: employerId } });
  return toItem(desig);
};

// The caller's live designation, or 404 (also for a malformed id).
const findDesignation = async (employerId, id, options = {}) => {
  const desig = UUID.test(String(id))
    ? await Designation.findOne({ where: { id, employer_id: employerId }, ...options })
    : null;
  if (!desig) throw new ErrorHandler("NOT_FOUND");
  return desig;
};

// GET /departments/:id/designations. Query is validated: { page, limit, search, status }
// ("" = no filter). Newest first, like the UI, which adds new designations at the top.
const listDesignations = async ({ employerId }, departmentId, { page, limit, search, status }) => {
  const dept = await findDepartment(employerId, departmentId, { attributes: ["id"] });

  const where = { employer_id: employerId, department_id: dept.id };
  if (status) where.status = status;
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [{ name: { [Op.like]: pattern } }, { code: { [Op.like]: pattern } }];
  }

  const [total, rows] = await Promise.all([
    Designation.count({ where }),
    Designation.findAll({
      attributes: ITEM_ATTRIBUTES,
      where,
      order: [
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: (page - 1) * limit,
    }),
  ]);

  return { items: rows.map(toItem), total, page, limit };
};

// GET /designations?departmentId= : what later screens may assign. Only ACTIVE designations
// whose department is ACTIVE and not deleted (D32), by name, no paging.
const listDesignationOptions = async ({ employerId }, { departmentId }) => {
  const where = { employer_id: employerId, status: "ACTIVE" };
  if (departmentId) where.department_id = departmentId;

  const rows = await Designation.findAll({
    attributes: ["id", "name", "code", "department_id"],
    where,
    include: [
      {
        model: Department,
        as: "department",
        attributes: [],
        required: true,
        where: { employer_id: employerId, status: "ACTIVE" },
      },
    ],
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
  });

  return { items: rows.map((row) => ({ id: row.id, name: row.name, code: row.code ?? null, department_id: row.department_id })) };
};

// Names are unique per department and codes per company, among live rows,
// case-insensitively (the column collation compares that way). No code = no check.
// When both clash, the name is reported.
const assertUnique = async (employerId, departmentId, { name, code }, exceptId) => {
  const scope = { employer_id: employerId };
  if (exceptId) scope.id = { [Op.ne]: exceptId };
  if (await Designation.findOne({ where: { ...scope, department_id: departmentId, name }, attributes: ["id"] })) {
    throw new ErrorHandler("DESIGNATION_NAME_TAKEN");
  }
  if (code && (await Designation.findOne({ where: { ...scope, code }, attributes: ["id"] }))) {
    throw new ErrorHandler("DESIGNATION_CODE_TAKEN");
  }
};

// The pre-check's backstop for concurrent saves (migration 104 keys).
const UNIQUE_KEY_CODES = {
  uq_hrms_designations_employer_id_department_id_name_live_key: "DESIGNATION_NAME_TAKEN",
  uq_hrms_designations_employer_id_code_live_key: "DESIGNATION_CODE_TAKEN",
};

// POST /departments/:id/designations. Body is validated (trimmed, code uppercased).
// An inactive department may still get designations; they're hidden from assignment.
const createDesignation = async ({ employerId, userId }, departmentId, body) => {
  const dept = await findDepartment(employerId, departmentId, { attributes: ["id"] });
  const code = orNull(body.code ?? null);
  await assertUnique(employerId, dept.id, { name: body.name, code });

  const desig = await saveOrClash(
    () =>
      Designation.create({
        employer_id: employerId,
        department_id: dept.id,
        name: body.name,
        code,
        description: orNull(body.description ?? null),
        status: body.status || "ACTIVE",
        created_by: userId,
        updated_by: userId,
      }),
    UNIQUE_KEY_CODES
  );
  return getItem(employerId, desig.id);
};

// PUT /designations/:id. name always; omitted optional fields keep their values.
// The department never changes.
const updateDesignation = async ({ employerId, userId }, id, body) => {
  const desig = await findDesignation(employerId, id);

  const changes = { name: body.name, updated_by: userId };
  if (body.code !== undefined) changes.code = orNull(body.code);
  if (body.description !== undefined) changes.description = orNull(body.description);
  if (body.status !== undefined) changes.status = body.status;
  const code = changes.code !== undefined ? changes.code : desig.code;
  await assertUnique(employerId, desig.department_id, { name: body.name, code }, desig.id);

  await saveOrClash(() => desig.update(changes), UNIQUE_KEY_CODES);
  return getItem(employerId, desig.id);
};

// DELETE /designations/:id. Blocked while any non-deleted employee (even an exited one)
// holds it; otherwise soft-deleted, and its name and code become reusable.
const deleteDesignation = async ({ employerId, userId }, id) =>
  sequelize.transaction(async (transaction) => {
    const desig = await findDesignation(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });

    const linked = await Employee.count({ where: { employer_id: employerId, designation_id: desig.id }, transaction });
    if (linked > 0) throw new ErrorHandler("DESIGNATION_IN_USE");

    await desig.update({ updated_by: userId }, { transaction });
    await desig.destroy({ transaction });
    return { id: desig.id };
  });

module.exports = { listDesignations, listDesignationOptions, createDesignation, updateDesignation, deleteDesignation };
