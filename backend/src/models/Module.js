"use strict";

module.exports = (sequelize, DataTypes) => {
  const Module = sequelize.define(
    "Module",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      module_key: { type: DataTypes.STRING(100), allowNull: false },
      name: { type: DataTypes.STRING(150), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "modules",
      underscored: true,
    }
  );

  Module.associate = (models) => {
    Module.hasMany(models.RolePermission, { as: "rolePermissions", foreignKey: "module_id" });
    Module.belongsToMany(models.Role, { as: "roles", through: models.RolePermission, foreignKey: "module_id", otherKey: "role_id" });
  };

  return Module;
};
