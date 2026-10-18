"use strict";

module.exports = (sequelize, DataTypes) => {
  const ExitChecklistItem = sequelize.define(
    "ExitChecklistItem",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      exit_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_employee_exits", key: "id" } },
      category: { type: DataTypes.ENUM("LOAN", "ASSETS", "FINANCE", "PROJECT", "ADMINISTRATION", "IT", "HR", "OTHER"), allowNull: false },
      label: { type: DataTypes.STRING(150), allowNull: false },
      is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.ENUM("PENDING", "DONE", "NA"), allowNull: false, defaultValue: "PENDING" },
      note: { type: DataTypes.STRING(500) },
      actioned_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      actioned_at: { type: DataTypes.DATE },
      auto_key: { type: DataTypes.STRING(30) },
    },
    {
      tableName: "hrms_exit_checklist_items",
      underscored: true,
    }
  );

  ExitChecklistItem.associate = (models) => {
    ExitChecklistItem.belongsTo(models.EmployeeExit, { as: "exit", foreignKey: "exit_id" });
    ExitChecklistItem.belongsTo(models.User, { as: "actionedBy", foreignKey: "actioned_by" });
  };

  return ExitChecklistItem;
};
