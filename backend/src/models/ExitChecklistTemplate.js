"use strict";

module.exports = (sequelize, DataTypes) => {
  const ExitChecklistTemplate = sequelize.define(
    "ExitChecklistTemplate",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      category: { type: DataTypes.ENUM("LOAN", "ASSETS", "FINANCE", "PROJECT", "ADMINISTRATION", "IT", "HR", "OTHER"), allowNull: false },
      label: { type: DataTypes.STRING(150), allowNull: false },
      is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_exit_checklist_templates",
      underscored: true,
    }
  );

  ExitChecklistTemplate.associate = (models) => {
    ExitChecklistTemplate.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
  };

  return ExitChecklistTemplate;
};
