"use strict";

module.exports = (sequelize, DataTypes) => {
  const ContractType = sequelize.define(
    "ContractType",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(500) },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_contract_types",
      underscored: true,
    }
  );

  ContractType.associate = (models) => {
    ContractType.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    ContractType.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    ContractType.hasMany(models.Contract, { as: "contracts", foreignKey: "contract_type_id" });
    ContractType.hasMany(models.ContractTemplate, { as: "contractTemplates", foreignKey: "contract_type_id" });
  };

  return ContractType;
};
