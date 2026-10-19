"use strict";

module.exports = (sequelize, DataTypes) => {
  const HrmsSession = sequelize.define(
    "HrmsSession",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      hrms_account_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_accounts", key: "id" } },
      access_token_hash: { type: DataTypes.STRING(128), allowNull: false },
      refresh_token_hash: { type: DataTypes.STRING(128), allowNull: false },
      status: { type: DataTypes.ENUM("ACTIVE", "REVOKED", "EXPIRED"), allowNull: false, defaultValue: "ACTIVE" },
      user_agent: { type: DataTypes.TEXT },
      ip_address: { type: DataTypes.STRING(80) },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      last_used_at: { type: DataTypes.DATE },
      revoked_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_sessions",
      underscored: true,
    }
  );

  HrmsSession.associate = (models) => {
    HrmsSession.belongsTo(models.HrmsAccount, { as: "hrmsAccount", foreignKey: "hrms_account_id" });
  };

  return HrmsSession;
};
