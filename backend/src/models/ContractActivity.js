"use strict";

module.exports = (sequelize, DataTypes) => {
  const ContractActivity = sequelize.define(
    "ContractActivity",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      contract_id: { type: DataTypes.UUID, references: { model: "hrms_contracts", key: "id" } },
      recipient_id: { type: DataTypes.UUID, references: { model: "hrms_contract_recipients", key: "id" } },
      action: { type: DataTypes.ENUM("CREATED", "UPDATED", "SENT", "VIEWED", "SIGNED", "SUBMITTED", "APPROVED", "DECLINED", "REJECTED", "COMPLETED", "REMINDED", "EXPIRED", "REVOKED"), allowNull: false },
      actor_user_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      description: { type: DataTypes.STRING(255) },
      meta: { type: DataTypes.JSON },
    },
    {
      tableName: "hrms_contract_activities",
      underscored: true,
      updatedAt: false,
    }
  );

  ContractActivity.associate = (models) => {
    ContractActivity.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ContractActivity.belongsTo(models.Contract, { as: "contract", foreignKey: "contract_id" });
    ContractActivity.belongsTo(models.ContractRecipient, { as: "recipient", foreignKey: "recipient_id" });
    ContractActivity.belongsTo(models.User, { as: "actorUser", foreignKey: "actor_user_id" });
  };

  return ContractActivity;
};
