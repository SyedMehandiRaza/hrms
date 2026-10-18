"use strict";

module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define(
    "Department",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50) },
      description: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
      dept_head_id: { type: DataTypes.UUID, references: { model: "employees", key: "id" } },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      updated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_departments",
      underscored: true,
      paranoid: true,
    }
  );

  Department.associate = (models) => {
    Department.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Department.belongsTo(models.Employee, { as: "deptHead", foreignKey: "dept_head_id" });
    Department.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    Department.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by" });
    Department.hasMany(models.Designation, { as: "designations", foreignKey: "department_id" });
    Department.hasMany(models.Employee, { as: "employees", foreignKey: "department_id" });
  };

  return Department;
};
