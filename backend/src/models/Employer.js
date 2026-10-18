"use strict";

module.exports = (sequelize, DataTypes) => {
  const Employer = sequelize.define(
    "Employer",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false, references: { model: "users", key: "id" } },
      industry_type_id: { type: DataTypes.UUID, references: { model: "industry_types", key: "id" } },
      company_name: { type: DataTypes.STRING(255), allowNull: false },
      company_logo: { type: DataTypes.TEXT },
      contact_person_name: { type: DataTypes.STRING(255) },
      company_email: { type: DataTypes.STRING(255) },
      company_phone_number: { type: DataTypes.STRING(30) },
      company_website: { type: DataTypes.STRING(255) },
      company_description: { type: DataTypes.TEXT },
      address: { type: DataTypes.TEXT },
      is_company_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      verification_requested: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      employer_status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE", "BANNED"), allowNull: false, defaultValue: "ACTIVE" },
      email_notification: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sms_notification: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "employers",
      underscored: true,
      paranoid: true,
    }
  );

  Employer.associate = (models) => {
    Employer.belongsTo(models.User, { as: "user", foreignKey: "user_id" });
    Employer.belongsTo(models.IndustryType, { as: "industryType", foreignKey: "industry_type_id" });
    Employer.hasOne(models.CompanyTimeSetting, { as: "companyTimeSetting", foreignKey: "employer_id" });
    Employer.hasMany(models.FinancialYear, { as: "financialYears", foreignKey: "employer_id" });
    Employer.hasMany(models.NumberSequence, { as: "numberSequences", foreignKey: "employer_id" });
    Employer.hasMany(models.PeriodLock, { as: "periodLocks", foreignKey: "employer_id" });
    Employer.hasMany(models.Role, { as: "roles", foreignKey: "employer_id" });
    Employer.hasMany(models.HrmsAccount, { as: "hrmsAccounts", foreignKey: "employer_id" });
    Employer.hasMany(models.Notification, { as: "notifications", foreignKey: "employer_id" });
  };

  return Employer;
};
