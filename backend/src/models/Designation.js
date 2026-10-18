"use strict";

module.exports = (sequelize, DataTypes) => {
  const Designation = sequelize.define(
    "Designation",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      department_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_departments", key: "id" } },
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50) },
      description: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      updated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_designations",
      underscored: true,
      paranoid: true,
    }
  );

  Designation.associate = (models) => {
    Designation.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Designation.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
    Designation.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    Designation.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by" });
  };

  return Designation;
};
