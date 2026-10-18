"use strict";

module.exports = (sequelize, DataTypes) => {
  const SalaryIncrementBatch = sequelize.define(
    "SalaryIncrementBatch",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      financial_year_id: { type: DataTypes.UUID, references: { model: "hrms_financial_years", key: "id" } },
      title: { type: DataTypes.STRING(150), allowNull: false },
      kind: { type: DataTypes.ENUM("BULK", "SINGLE"), allowNull: false, defaultValue: "BULK" },
      type: { type: DataTypes.ENUM("PERCENT", "AMOUNT"), allowNull: false },
      value: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      applies_to: { type: DataTypes.ENUM("BASIC_ONLY", "ALL_FIXED"), allowNull: false, defaultValue: "BASIC_ONLY" },
      effective_month: { type: DataTypes.TINYINT, allowNull: false },
      effective_year: { type: DataTypes.SMALLINT, allowNull: false },
      effective_date: { type: DataTypes.DATEONLY },
      reason: { type: DataTypes.STRING(500) },
      filters: { type: DataTypes.JSON },
      status: { type: DataTypes.ENUM("DRAFT", "APPLIED", "REVERTED"), allowNull: false, defaultValue: "DRAFT" },
      applied_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      applied_at: { type: DataTypes.DATE },
      reverted_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_salary_increment_batches",
      underscored: true,
    }
  );

  SalaryIncrementBatch.associate = (models) => {
    SalaryIncrementBatch.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    SalaryIncrementBatch.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
    SalaryIncrementBatch.belongsTo(models.User, { as: "appliedBy", foreignKey: "applied_by" });
    SalaryIncrementBatch.hasMany(models.SalaryIncrementLine, { as: "salaryIncrementLines", foreignKey: "batch_id" });
  };

  return SalaryIncrementBatch;
};
