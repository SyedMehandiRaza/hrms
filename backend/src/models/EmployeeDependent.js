"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployeeDependent = sequelize.define(
    "EmployeeDependent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      full_name: { type: DataTypes.STRING(255), allowNull: false },
      relationship: { type: DataTypes.ENUM("SPOUSE", "CHILD", "PARENT", "OTHER"), allowNull: false },
      id_details: { type: DataTypes.STRING(255) },
      date_of_birth: { type: DataTypes.DATEONLY },
      gender: { type: DataTypes.ENUM("MALE", "FEMALE", "OTHER") },
      nationality: { type: DataTypes.STRING(100) },
      contact: { type: DataTypes.STRING(30) },
      photo_url: { type: DataTypes.TEXT },
      document_url: { type: DataTypes.TEXT },
      document_name: { type: DataTypes.STRING(255) },
      status: { type: DataTypes.ENUM("PENDING", "VERIFIED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
      reviewed_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      reviewed_at: { type: DataTypes.DATE },
      reject_reason: { type: DataTypes.TEXT },
    },
    {
      tableName: "hrms_employee_dependents",
      underscored: true,
      paranoid: true,
    }
  );

  EmployeeDependent.associate = (models) => {
    EmployeeDependent.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    EmployeeDependent.belongsTo(models.User, { as: "reviewedBy", foreignKey: "reviewed_by" });
  };

  return EmployeeDependent;
};
