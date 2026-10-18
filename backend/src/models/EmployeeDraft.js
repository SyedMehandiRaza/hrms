"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeDraft = sequelize.define(
    "EmployeeDraft",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      full_name: { type: DataTypes.STRING(255) },
      email: { type: DataTypes.STRING(255) },
      current_step: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
      data: { type: DataTypes.JSON, allowNull: false },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      updated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_employee_drafts",
      underscored: true,
      paranoid: true,
    }
  );

  EmployeeDraft.associate = (models) => {
    EmployeeDraft.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    EmployeeDraft.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    EmployeeDraft.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by" });
  };

  return EmployeeDraft;
};
