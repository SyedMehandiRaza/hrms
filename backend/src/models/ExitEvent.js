"use strict";

module.exports = (sequelize, DataTypes) => {
  const ExitEvent = sequelize.define(
    "ExitEvent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      exit_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_employee_exits", key: "id" } },
      event_type: { type: DataTypes.ENUM("RAISED", "TERMS_UPDATED", "LWD_EXTENDED", "LWD_REVERTED", "CHECKLIST_UPDATED", "ITEM_ADDED", "SETTLEMENT_POSTED", "ADJUSTMENT_ADDED", "EXITED", "COMPLETED", "CANCELLED", "REHIRED", "CONFIRMED", "CONFIRMED_WITH_OVERRIDE", "RELIEVED_EARLY", "DOCUMENT_GENERATED", "DOCUMENT_SENT", "CLEARANCE_UPLOADED", "APPROVED", "REJECTED", "WITHDRAWN"), allowNull: false },
      payload: { type: DataTypes.JSON },
      actor_user_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      // DATETIME(3): the timeline is ordered by created_at, so milliseconds must be written too.
      createdAt: { type: DataTypes.DATE(3) },
    },
    {
      tableName: "hrms_exit_events",
      underscored: true,
      updatedAt: false,
    }
  );

  ExitEvent.associate = (models) => {
    ExitEvent.belongsTo(models.EmployeeExit, { as: "exit", foreignKey: "exit_id" });
    ExitEvent.belongsTo(models.User, { as: "actorUser", foreignKey: "actor_user_id" });
  };

  return ExitEvent;
};
