"use strict";

module.exports = (sequelize, DataTypes) => {
  const Country = sequelize.define(
    "Country",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      name_ar: { type: DataTypes.STRING(150) },
      calling_code: { type: DataTypes.STRING(10), allowNull: false },
      flag: { type: DataTypes.STRING(16) },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      iso2: { type: DataTypes.CHAR(2), allowNull: false },
      iso3: { type: DataTypes.CHAR(3) },
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
