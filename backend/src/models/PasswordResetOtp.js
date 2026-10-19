"use strict";

module.exports = (sequelize, DataTypes) => {
  const PasswordResetOtp = sequelize.define(
    "PasswordResetOtp",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "users", key: "id" } },
      otp_hash: { type: DataTypes.STRING(128), allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      consumed_at: { type: DataTypes.DATE },
      reset_token_hash: { type: DataTypes.CHAR(64) },
      reset_token_expires_at: { type: DataTypes.DATE },
    },
    {
      tableName: "password_reset_otps",
      underscored: true,
    }
  );

  PasswordResetOtp.associate = (models) => {
    PasswordResetOtp.belongsTo(models.User, { as: "user", foreignKey: "user_id" });
  };

  return PasswordResetOtp;
};
