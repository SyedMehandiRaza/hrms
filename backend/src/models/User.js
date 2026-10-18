"use strict";

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(150) },
      email: { type: DataTypes.STRING(255), allowNull: false },
      phone_number: { type: DataTypes.STRING(30) },
      password: { type: DataTypes.STRING(255) },
      user_status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE", "BLOCKED", "SUSPENDED"), allowNull: false, defaultValue: "ACTIVE" },
      is_email_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_number_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      signup_by: { type: DataTypes.ENUM("EMAIL", "PHONE", "GOOGLE", "APPLE") },
      provider: { type: DataTypes.ENUM("EMAIL", "PHONE", "GOOGLE", "APPLE") },
      provider_id: { type: DataTypes.STRING(255) },
      signup_step: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      lang_key: { type: DataTypes.ENUM("EN", "AR"), allowNull: false, defaultValue: "EN" },
      fcm_token: { type: DataTypes.TEXT },
      last_seen_at: { type: DataTypes.DATE },
    },
    {
      tableName: "users",
      underscored: true,
      paranoid: true,
      defaultScope: { attributes: { exclude: ["password"] } },
      scopes: { withPassword: {} },
    }
  );

  User.associate = (models) => {
    User.hasMany(models.PasswordResetOtp, { as: "passwordResetOtps", foreignKey: "user_id" });
    User.hasOne(models.Employer, { as: "employer", foreignKey: "user_id" });
    User.hasMany(models.HrmsAccount, { as: "hrmsAccountsAsUser", foreignKey: "user_id" });
    User.hasMany(models.Notification, { as: "notifications", foreignKey: "user_id" });
    User.hasMany(models.StaffingCompany, { as: "staffingCompaniesAsUser", foreignKey: "user_id" });
    User.hasMany(models.Employee, { as: "employees", foreignKey: "user_id" });
  };

  return User;
};
