"use strict";

module.exports = (sequelize, DataTypes) => {
  const SalaryTransaction = sequelize.define(
    "SalaryTransaction",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      employee_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employees", key: "id" } },
      project_id: { type: DataTypes.UUID, references: { model: "projects", key: "id" } },
      period_year: { type: DataTypes.SMALLINT, allowNull: false },
      period_month: { type: DataTypes.TINYINT, allowNull: false },
      type: { type: DataTypes.ENUM("EARNING", "DEDUCTION"), allowNull: false },
      is_advance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      salary_component_id: { type: DataTypes.UUID, references: { model: "hrms_salary_components", key: "id" } },
      label: { type: DataTypes.STRING(150), allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      created_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
    },
    {
      tableName: "hrms_salary_transactions",
      underscored: true,
      paranoid: true,
    }
  );

  SalaryTransaction.associate = (models) => {
    SalaryTransaction.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    SalaryTransaction.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });
    SalaryTransaction.belongsTo(models.Project, { as: "project", foreignKey: "project_id" });
    SalaryTransaction.belongsTo(models.SalaryComponent, { as: "salaryComponent", foreignKey: "salary_component_id" });
    SalaryTransaction.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by" });
    SalaryTransaction.hasMany(models.LeaveEncashmentRequest, { as: "leaveEncashmentRequests", foreignKey: "salary_transaction_id" });
    SalaryTransaction.hasMany(models.LoanPayment, { as: "loanPayments", foreignKey: "salary_transaction_id" });
  };

  return SalaryTransaction;
};
