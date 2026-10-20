"use strict";

module.exports = (sequelize, DataTypes) => {
  const StaffingCompany = sequelize.define(
    "StaffingCompany",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      user_id: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      name: { type: DataTypes.STRING(255), allowNull: false },
      code: { type: DataTypes.STRING(100) },
      email: { type: DataTypes.STRING(255) },
      phone: { type: DataTypes.STRING(30) },
      phone_country: { type: DataTypes.CHAR(2) },
      contact_person_name: { type: DataTypes.STRING(255) },
      contact_person_email: { type: DataTypes.STRING(255) },
      contact_person_phone: { type: DataTypes.STRING(30) },
      contact_person_phone_country: { type: DataTypes.CHAR(2) },
      // Deprecated text; city_id is the source (countries-cities-phones §3).
      city: { type: DataTypes.STRING(100) },
      country_id: { type: DataTypes.UUID, references: { model: "countries", key: "id" } },
      city_id: { type: DataTypes.UUID, references: { model: "cities", key: "id" } },
      address: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
      signature_url: { type: DataTypes.STRING(512) },
      signature_type: { type: DataTypes.ENUM("DRAWN", "TYPED", "UPLOADED") },
      signature_updated_at: { type: DataTypes.DATE },
      company_image: { type: DataTypes.STRING(500) },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      updated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_staffing_companies",
      underscored: true,
      paranoid: true,
    }
  );

  StaffingCompany.associate = (models) => {
    StaffingCompany.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    StaffingCompany.belongsTo(models.Country, { as: "country", foreignKey: "country_id" });
    StaffingCompany.belongsTo(models.City, { as: "cityRef", foreignKey: "city_id" });
    StaffingCompany.belongsTo(models.User, { as: "user", foreignKey: "user_id" });
    StaffingCompany.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    StaffingCompany.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by" });
    StaffingCompany.hasMany(models.StaffingCompanyProject, { as: "staffingCompanyProjects", foreignKey: "staffing_company_id" });
    StaffingCompany.hasMany(models.Employee, { as: "employees", foreignKey: "staffing_company_id" });
    StaffingCompany.hasMany(models.StaffingRate, { as: "staffingRates", foreignKey: "staffing_company_id" });
    StaffingCompany.hasMany(models.StaffingBill, { as: "staffingBills", foreignKey: "staffing_company_id" });
    StaffingCompany.hasMany(models.ContractRecipient, { as: "contractRecipients", foreignKey: "staffing_company_id" });
    StaffingCompany.hasMany(models.YearDocument, { as: "yearDocuments", foreignKey: "staffing_company_id" });
    StaffingCompany.belongsToMany(models.Project, { as: "projects", through: models.StaffingCompanyProject, foreignKey: "staffing_company_id", otherKey: "project_id" });
  };

  return StaffingCompany;
};
