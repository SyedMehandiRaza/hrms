"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_policies",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        leave_type_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" }, onDelete: "CASCADE" },
        policy_name: { type: Sequelize.STRING(150), allowNull: false },
        yearly_quota: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        monthly_accrual: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        accrual_frequency: { type: Sequelize.ENUM("MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"), allowNull: false, defaultValue: "MONTHLY" },
        accrual_day: { type: Sequelize.TINYINT, allowNull: true },
        allow_carry_forward: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        max_carry_forward_days: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        allow_negative_balance: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        allow_encashment: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        max_encashment_days: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        effective_from: { type: Sequelize.DATEONLY, allowNull: true },
        effective_to: { type: Sequelize.DATEONLY, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        carry_forward_expiry_months: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        year_end_excess: { type: Sequelize.ENUM("LAPSE", "ENCASH"), allowNull: false, defaultValue: "LAPSE" },
        accrual_method: { type: Sequelize.ENUM("MONTHLY_ACCRUAL", "UPFRONT"), allowNull: false, defaultValue: "MONTHLY_ACCRUAL" },
        prorate_joiners: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_policies");
  },
};
