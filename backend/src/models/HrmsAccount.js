"use strict";

module.exports = (sequelize, DataTypes) => {
  const HrmsAccount = sequelize.define(
    "HrmsAccount",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "users", key: "id" } },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      access_level: { type: DataTypes.ENUM("ADMIN", "SUB_ADMIN", "EMPLOYEE", "GENERAL_EMPLOYEE", "STAFFING_COMPANY"), allowNull: false },
      role_id: { type: DataTypes.UUID, references: { model: "roles", key: "id" } },
      status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE", "SUSPENDED"), allowNull: false, defaultValue: "ACTIVE" },
      last_login_at: { type: DataTypes.DATE },
      password_setup_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      password_set_at: { type: DataTypes.DATE },
      password_setup_token_hash: { type: DataTypes.STRING(128) },
      password_setup_token_expires_at: { type: DataTypes.DATE },
      invited_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      invited_at: { type: DataTypes.DATE },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      updated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_accounts",
      underscored: true,
      paranoid: true,
    }
  );

  HrmsAccount.associate = (models) => {
    HrmsAccount.belongsTo(models.User, { as: "user", foreignKey: "user_id" });
    HrmsAccount.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    HrmsAccount.belongsTo(models.Role, { as: "role", foreignKey: "role_id" });
    HrmsAccount.belongsTo(models.User, { as: "invitedBy", foreignKey: "invited_by" });
    HrmsAccount.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    HrmsAccount.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by" });
    HrmsAccount.hasMany(models.HrmsSession, { as: "hrmsSessions", foreignKey: "hrms_account_id" });
  };

  return HrmsAccount;
};
