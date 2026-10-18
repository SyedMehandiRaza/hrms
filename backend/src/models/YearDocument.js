"use strict";

module.exports = (sequelize, DataTypes) => {
  const YearDocument = sequelize.define(
    "YearDocument",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      financial_year_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" } },
      employee_id: { type: DataTypes.UUID, references: { model: "employees", key: "id" } },
      staffing_company_id: { type: DataTypes.UUID, references: { model: "hrms_staffing_companies", key: "id" } },
      doc_type: { type: DataTypes.ENUM("ANNUAL_PAY_STATEMENT", "SALARY_REGISTER", "LEAVE_SUMMARY", "LOAN_STATEMENT", "STAFFING_STATEMENT", "OVERTIME_SUMMARY", "HEADCOUNT_REPORT"), allowNull: false },
      storage_key: { type: DataTypes.STRING(500), allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      generated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      generated_at: { type: DataTypes.DATE, allowNull: false },
      sent_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_year_documents",
      underscored: true,
    }
  );

  YearDocument.associate = (models) => {
    YearDocument.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
    YearDocument.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    YearDocument.belongsTo(models.StaffingCompany, { as: "staffingCompany", foreignKey: "staffing_company_id" });
    YearDocument.belongsTo(models.User, { as: "generatedBy", foreignKey: "generated_by" });
  };

  return YearDocument;
};
