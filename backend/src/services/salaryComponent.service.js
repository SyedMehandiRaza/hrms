const { Op } = require("sequelize");
const { sequelize, SalaryComponent, EmployeeSalaryComponent } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { saveOrClash } = require("../utils/uniqueClash");
const { UUID, likePattern, orNull } = require("./department.service");

// Salary components (docs/plans/workforce-and-lifecycle.md D41–D43). Always the caller's own
// company. System components (Basic, Housing, Transport, Hourly) can't be edited or deactivated;
// a component's type is locked once a salary uses it; "Delete" deactivates.

const CODE_MAX = 50;

const toItem = (c) => ({
  id: c.id,
  name: c.name,
  code: c.code,
  type: c.type,
  description: c.description ?? null,
  is_default: Boolean(c.is_default),
  is_system: Boolean(c.is_system),
  status: c.is_active ? "ACTIVE" : "INACTIVE",
  used_on_salaries: Number(c.get("used_on_salaries") || 0),
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

const ITEM_QUERY = {
  attributes: {
    include: [
      [
        sequelize.literal(
          "(SELECT COUNT(*) FROM `hrms_employee_salary_components` esc WHERE esc.salary_component_id = `SalaryComponent`.`id`)"
        ),
        "used_on_salaries",
      ],
    ],
  },
};

// The caller's component, or 404 (also for a malformed id).
const findComponent = async (employerId, id, options = {}) => {
  const c = UUID.test(String(id)) ? await SalaryComponent.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!c) throw new ErrorHandler("NOT_FOUND");
  return c;
};

// GET /salary-components?search=&type=&status=&page=&limit= (defaults first, then by name).
const listComponents = async ({ employerId }, { page, limit, search, type, status }) => {
  const where = { employer_id: employerId };
  if (type) where.type = type;
  if (status) where.is_active = status === "ACTIVE";
  if (search) where.name = { [Op.like]: likePattern(search) };
  const { count, rows } = await SalaryComponent.findAndCountAll({
    ...ITEM_QUERY,
    where,
    order: [
      ["is_default", "DESC"],
      ["is_system", "DESC"],
      ["name", "ASC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: rows.map(toItem), total: count, page, limit };
};

const getComponent = async ({ employerId }, id) => toItem(await findComponent(employerId, id, ITEM_QUERY));

// "Site Allowance" → "SITE_ALLOWANCE"; a code the company already uses gets "_2", "_3"… (D41).
const codeFor = async (employerId, name, transaction) => {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, CODE_MAX) || "COMPONENT";
  const taken = new Set(
    (await SalaryComponent.findAll({ where: { employer_id: employerId }, attributes: ["code"], raw: true, transaction })).map((r) =>
      String(r.code || "").toUpperCase()
    )
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, CODE_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
};

const UNIQUE_KEY_CODES = { uq_hrms_salary_components_employer_id_name: "SALARY_COMPONENT_NAME_TAKEN" };

const assertNameFree = async (employerId, name, exceptId, transaction) => {
  const where = { employer_id: employerId, name };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  if (await SalaryComponent.findOne({ where, attributes: ["id"], transaction })) throw new ErrorHandler("SALARY_COMPONENT_NAME_TAKEN");
};

// POST /salary-components
const createComponent = async ({ employerId }, body) => {
  const id = await sequelize.transaction(async (transaction) => {
    await assertNameFree(employerId, body.name, null, transaction);
    const c = await saveOrClash(
      async () =>
        SalaryComponent.create(
          {
            employer_id: employerId,
            name: body.name,
            code: await codeFor(employerId, body.name, transaction),
            type: body.type,
            description: orNull(body.description ?? null),
            is_active: body.status !== "INACTIVE",
          },
          { transaction }
        ),
      UNIQUE_KEY_CODES
    );
    return c.id;
  });
  return getComponent({ employerId }, id);
};

// PUT /salary-components/:id. The code never changes.
const updateComponent = async ({ employerId }, id, body) => {
  await sequelize.transaction(async (transaction) => {
    const c = await findComponent(employerId, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (c.is_system) throw new ErrorHandler("SALARY_COMPONENT_SYSTEM");
    await assertNameFree(employerId, body.name, c.id, transaction);
    if (body.type !== c.type && (await EmployeeSalaryComponent.count({ where: { salary_component_id: c.id }, transaction }))) {
      throw new ErrorHandler("SALARY_COMPONENT_TYPE_LOCKED");
    }
    const changes = { name: body.name, type: body.type };
    if (body.description !== undefined) changes.description = orNull(body.description);
    if (body.status !== undefined) changes.is_active = body.status === "ACTIVE";
    await saveOrClash(() => c.update(changes, { transaction }), UNIQUE_KEY_CODES);
  });
  return getComponent({ employerId }, id);
};

// DELETE /salary-components/:id = deactivate (D43): not offered for new salaries; existing ones keep it.
const deactivateComponent = async ({ employerId }, id) => {
  const c = await findComponent(employerId, id);
  if (c.is_system) throw new ErrorHandler("SALARY_COMPONENT_SYSTEM");
  await c.update({ is_active: false });
  return getComponent({ employerId }, id);
};

module.exports = { listComponents, getComponent, createComponent, updateComponent, deactivateComponent };
