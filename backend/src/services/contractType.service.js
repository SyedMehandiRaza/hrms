const { Op, UniqueConstraintError } = require("sequelize");
const { ContractType, ContractTemplate, Contract } = require("../models");
const ErrorHandler = require("../utils/ErrorHandler");
const { likePattern, UUID } = require("./department.service");

// Company contract types (plan decisions 15–17). Name and code unique per company,
// case-insensitive (collation); code stored uppercase. A type used by any template or
// contract (deleted ones included: the foreign keys still point at it) can't be deleted;
// an unused one is hard-deleted (the table has no deleted_at).

const toItem = (type) => ({
  id: type.id,
  name: type.name,
  code: type.code,
  description: type.description ?? null,
  is_active: type.is_active,
  created_at: type.createdAt,
  updated_at: type.updatedAt,
});

const findType = async (employerId, id, options = {}) => {
  const type = UUID.test(String(id)) ? await ContractType.findOne({ where: { id, employer_id: employerId }, ...options }) : null;
  if (!type) throw new ErrorHandler("NOT_FOUND");
  return type;
};

// Name first, then code (the order the form shows them).
const assertUnique = async (employerId, { name, code }, exceptId) => {
  const others = { employer_id: employerId };
  if (exceptId) others.id = { [Op.ne]: exceptId };
  if (await ContractType.count({ where: { ...others, name } })) throw new ErrorHandler("CONTRACT_TYPE_NAME_TAKEN");
  if (await ContractType.count({ where: { ...others, code } })) throw new ErrorHandler("CONTRACT_TYPE_CODE_TAKEN");
};

// A concurrent insert can still hit the unique keys: report the same codes.
const mapUniqueError = (err) => {
  if (err instanceof UniqueConstraintError) {
    const key = JSON.stringify(err.errors?.map((e) => e.path) || err.fields || {});
    throw new ErrorHandler(key.includes("name") ? "CONTRACT_TYPE_NAME_TAKEN" : "CONTRACT_TYPE_CODE_TAKEN");
  }
  throw err;
};

const listTypes = async ({ employerId }, { page, limit, search, status }) => {
  const where = { employer_id: employerId };
  if (status) where.is_active = status === "ACTIVE";
  if (search) {
    const pattern = likePattern(search);
    where[Op.or] = [{ name: { [Op.like]: pattern } }, { code: { [Op.like]: pattern } }];
  }
  const { count, rows } = await ContractType.findAndCountAll({
    where,
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: rows.map(toItem), total: count, page, limit };
};

const getType = async ({ employerId }, id) => toItem(await findType(employerId, id));

const createType = async ({ employerId, userId }, body) => {
  await assertUnique(employerId, body);
  const type = await ContractType.create({
    employer_id: employerId,
    name: body.name,
    code: body.code,
    description: body.description || null,
    is_active: body.is_active ?? true,
    created_by: userId,
  }).catch(mapUniqueError);
  return toItem(type);
};

const updateType = async ({ employerId }, id, body) => {
  const type = await findType(employerId, id);
  await assertUnique(employerId, body, type.id);
  const changes = { name: body.name, code: body.code };
  if (body.description !== undefined) changes.description = body.description || null;
  if (body.is_active !== undefined) changes.is_active = body.is_active;
  await type.update(changes).catch(mapUniqueError);
  return toItem(type);
};

const deleteType = async ({ employerId }, id) => {
  const type = await findType(employerId, id);
  const used =
    (await ContractTemplate.count({ where: { contract_type_id: type.id }, paranoid: false })) ||
    (await Contract.count({ where: { contract_type_id: type.id }, paranoid: false }));
  if (used) throw new ErrorHandler("CONTRACT_TYPE_IN_USE");
  await type.destroy();
  return { id: type.id };
};

module.exports = { listTypes, getType, createType, updateType, deleteType, findType };
