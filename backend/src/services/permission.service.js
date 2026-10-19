const { Module, Role, RolePermission } = require("../models");
const { ACCESS_LEVELS } = require("../constants/accessLevels");

const ACTIONS = Object.freeze(["read", "create", "update", "delete"]);

const flags = (value) => Object.fromEntries(ACTIONS.map((action) => [action, value]));

// { module_key: { read, create, update, delete } } for every module (standards §4, D7).
// ADMIN (the owner) gets everything; an account with no role (or a role that was
// deleted or belongs to another company) gets everything false. Loaded on every
// request so role changes apply immediately (D34).
const loadPermissions = async ({ accessLevel, roleId, employerId }) => {
  const modules = await Module.findAll({ attributes: ["id", "module_key"], order: [["sort_order", "ASC"]] });

  if (accessLevel === ACCESS_LEVELS.ADMIN) {
    return Object.fromEntries(modules.map((m) => [m.module_key, flags(true)]));
  }

  const permissions = Object.fromEntries(modules.map((m) => [m.module_key, flags(false)]));
  if (!roleId) return permissions;

  const rows = await RolePermission.findAll({
    where: { role_id: roleId },
    include: [
      { model: Role, as: "role", attributes: [], where: { employer_id: employerId }, required: true },
      { model: Module, as: "module", attributes: ["module_key"], required: true },
    ],
  });
  rows.forEach((row) => {
    permissions[row.module.module_key] = {
      read: row.can_read,
      create: row.can_create,
      update: row.can_update,
      delete: row.can_delete,
    };
  });
  return permissions;
};

module.exports = { ACTIONS, loadPermissions };
