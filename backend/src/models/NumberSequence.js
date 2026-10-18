"use strict";

module.exports = (sequelize, DataTypes) => {
  const NumberSequence = sequelize.define(
    "NumberSequence",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      doc_type: { type: DataTypes.ENUM("STAFFING_BILL", "LOAN", "CONTRACT", "PAYROLL_RUN"), allowNull: false },
      financial_year_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" } },
      last_no: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "hrms_number_sequences",
      underscored: true,
    }
  );

  NumberSequence.associate = (models) => {
    NumberSequence.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    NumberSequence.belongsTo(models.FinancialYear, { as: "financialYear", foreignKey: "financial_year_id" });
  };

  return NumberSequence;
};
