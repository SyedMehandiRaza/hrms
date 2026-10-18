"use strict";

module.exports = (sequelize, DataTypes) => {
  const Country = sequelize.define(
    "Country",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      calling_code: { type: DataTypes.STRING(10) },
      iso2: { type: DataTypes.CHAR(2) },
    },
    {
      tableName: "countries",
      underscored: true,
    }
  );

  Country.associate = (models) => {
    Country.hasMany(models.City, { as: "cities", foreignKey: "country_id" });
  };

  return Country;
};
