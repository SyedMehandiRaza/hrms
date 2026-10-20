"use strict";

module.exports = (sequelize, DataTypes) => {
  const Office = sequelize.define(
    "Office",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      office_name: { type: DataTypes.STRING(255), allowNull: false },
      office_email: { type: DataTypes.STRING(255) },
      office_phone: { type: DataTypes.STRING(30) },
      phone_country: { type: DataTypes.CHAR(2) },
      country_id: { type: DataTypes.UUID, references: { model: "countries", key: "id" } },
      city_id: { type: DataTypes.UUID, references: { model: "cities", key: "id" } },
      office_location: { type: DataTypes.STRING(255) },
      lat: { type: DataTypes.DECIMAL(10, 7) },
      lng: { type: DataTypes.DECIMAL(10, 7) },
      // No stored status: Active = has a project, Unassigned = none (workforce D3, ADR 0010).
      office_image: { type: DataTypes.STRING(500) },
    },
    {
      tableName: "offices",
      underscored: true,
      paranoid: true,
    }
  );

  Office.associate = (models) => {
    Office.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    Office.belongsTo(models.Country, { as: "country", foreignKey: "country_id" });
    Office.belongsTo(models.City, { as: "city", foreignKey: "city_id" });
    // At most one (unique projects.office_id, ADR 0010).
    Office.hasMany(models.Project, { as: "projects", foreignKey: "office_id" });
    Office.hasOne(models.Project, { as: "project", foreignKey: "office_id" });
    // Deprecated link (employees.office_id is not read or written; workforce §3).
    Office.hasMany(models.Employee, { as: "employees", foreignKey: "office_id" });
  };

  return Office;
};
