"use strict";

module.exports = (sequelize, DataTypes) => {
  const LeavePolicy = sequelize.define(
    "LeavePolicy",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      employer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "employers", key: "id" } },
      leave_type_id: { type: DataTypes.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" } },
      policy_name: { type: DataTypes.STRING(150), allowNull: false },
      yearly_quota: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      monthly_accrual: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      accrual_frequency: { type: DataTypes.ENUM("MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"), allowNull: false, defaultValue: "MONTHLY" },
      accrual_day: { type: DataTypes.TINYINT },
      allow_carry_forward: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      max_carry_forward_days: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      allow_negative_balance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      allow_encashment: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      max_encashment_days: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
      effective_from: { type: DataTypes.DATEONLY },
      effective_to: { type: DataTypes.DATEONLY },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      carry_forward_expiry_months: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      year_end_excess: { type: DataTypes.ENUM("LAPSE", "ENCASH"), allowNull: false, defaultValue: "LAPSE" },
      accrual_method: { type: DataTypes.ENUM("MONTHLY_ACCRUAL", "UPFRONT"), allowNull: false, defaultValue: "MONTHLY_ACCRUAL" },
      prorate_joiners: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "hrms_leave_policies",
      underscored: true,
      paranoid: true,
    }
  );

  LeavePolicy.associate = (models) => {
    LeavePolicy.belongsTo(models.Employer, { as: "employer", foreignKey: "employer_id" });
    LeavePolicy.belongsTo(models.LeaveType, { as: "leaveType", foreignKey: "leave_type_id" });
  };

  return LeavePolicy;
};
