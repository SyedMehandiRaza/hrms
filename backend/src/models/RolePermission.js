"use strict";

module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define(
    "RolePermission",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      role_id: { type: DataTypes.UUID, allowNull: false, references: { model: "roles", key: "id" } },
      module_id: { type: DataTypes.UUID, allowNull: false, references: { model: "modules", key: "id" } },
      can_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_create: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_update: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      can_delete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "role_permissions",
      underscored: true,
    }
  );

  RolePermission.associate = (models) => {
    RolePermission.belongsTo(models.Role, { as: "role", foreignKey: "role_id" });
    RolePermission.belongsTo(models.Module, { as: "module", foreignKey: "module_id" });
  };

  return RolePermission;
};
