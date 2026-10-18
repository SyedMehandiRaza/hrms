"use strict";

module.exports = (sequelize, DataTypes) => {
  const StaffingBill = sequelize.define(
    "StaffingBill",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      staffing_company_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_staffing_companies", key: "id" } },
      bill_no: { type: DataTypes.STRING(30), allowNull: false },
      period_month: { type: DataTypes.TINYINT, allowNull: false },
      period_year: { type: DataTypes.SMALLINT, allowNull: false },
      status: { type: DataTypes.ENUM("DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PAID"), allowNull: false, defaultValue: "DRAFT" },
      reject_reason: { type: DataTypes.TEXT },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "SAR" },
      total_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      approval_request_id: { type: DataTypes.UUID, references: { model: "hrms_approval_requests", key: "id" } },
      generated_by: { type: DataTypes.UUID, references: { model: "users", key: "id" } },
      generated_at: { type: DataTypes.DATE },
      sent_to_portal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sent_at: { type: DataTypes.DATE },
      paid_at: { type: DataTypes.DATE },
    },
    {
      tableName: "hrms_staffing_bills",
      underscored: true,
      paranoid: true,
    }
  );

  StaffingBill.associate = (models) => {
    StaffingBill.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    StaffingBill.belongsTo(models.StaffingCompany, { as: "staffingCompany", foreignKey: "staffing_company_id" });
    StaffingBill.belongsTo(models.ApprovalRequest, { as: "approvalRequest", foreignKey: "approval_request_id" });
    StaffingBill.belongsTo(models.User, { as: "generatedBy", foreignKey: "generated_by" });
    StaffingBill.hasMany(models.StaffingBillItem, { as: "staffingBillItems", foreignKey: "bill_id" });
  };

  return StaffingBill;
};
