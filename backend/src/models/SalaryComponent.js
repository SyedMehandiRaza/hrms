"use strict";

module.exports = (sequelize, DataTypes) => {
  const SalaryComponent = sequelize.define(
    "SalaryComponent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      name: { type: DataTypes.STRING(100), allowNull: false },
      code: { type: DataTypes.STRING(50) },
      type: { type: DataTypes.ENUM("EARNING", "DEDUCTION"), allowNull: false },
      description: { type: DataTypes.STRING(255) },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_salary_components",
      underscored: true,
    }
  );

  SalaryComponent.associate = (models) => {
    SalaryComponent.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
  };

  return SalaryComponent;
};
