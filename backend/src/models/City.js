"use strict";

module.exports = (sequelize, DataTypes) => {
  const City = sequelize.define(
    "City",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      country_id: { type: DataTypes.UUID, references: { model: "countries", key: "id" } },
      city_name: { type: DataTypes.STRING(150), allowNull: false },
      city_code: { type: DataTypes.STRING(50) },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "cities",
      underscored: true,
    }
  );

  City.associate = (models) => {
    City.belongsTo(models.Country, { as: "country", foreignKey: "country_id" });
  };

  return City;
};
