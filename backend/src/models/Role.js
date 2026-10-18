"use strict";

module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    "Role",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(255) },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "roles",
      underscored: true,
      paranoid: true,
    }
  );

  Role.associate = (models) => {
    Role.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Role.hasMany(models.RolePermission, { as: "rolePermissions", foreignKey: "role_id" });
    Role.hasMany(models.HrmsAccount, { as: "hrmsAccounts", foreignKey: "role_id" });
    Role.belongsToMany(models.Module, { as: "modules", through: models.RolePermission, foreignKey: "role_id", otherKey: "module_id" });
  };

  return Role;
};
