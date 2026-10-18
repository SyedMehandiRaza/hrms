"use strict";

module.exports = (sequelize, DataTypes) => {
  const IndustryType = sequelize.define(
    "IndustryType",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      industry_name: { type: DataTypes.STRING(255), allowNull: false },
      industry_image: { type: DataTypes.STRING(255) },
    },
    {
      tableName: "industry_types",
      underscored: true,
      paranoid: true,
    }
  );

  IndustryType.associate = (models) => {
    IndustryType.hasMany(models.Employer, { as: "employers", foreignKey: "industry_type_id" });
  };

  return IndustryType;
};
