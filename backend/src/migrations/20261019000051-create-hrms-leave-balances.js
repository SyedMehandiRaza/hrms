"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_leave_balances",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        employee_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employees", key: "id" }, onDelete: "CASCADE" },
        leave_type_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_leave_types", key: "id" }, onDelete: "CASCADE" },
        leave_policy_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_leave_policies", key: "id" }, onDelete: "SET NULL" },
        financial_year_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_financial_years", key: "id" }, onDelete: "SET NULL" },
        balance_year: { type: Sequelize.SMALLINT, allowNull: false },
        opening_balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        accrued_balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        carry_forward_balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        adjusted_balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        consumed_balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        encashed_balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        expired_balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        total_allocated: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        available_balance: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        last_accrual_date: { type: Sequelize.DATEONLY, allowNull: true },
        last_encashment_date: { type: Sequelize.DATEONLY, allowNull: true },
        status: { type: Sequelize.ENUM("OPEN", "CLOSED"), allowNull: false, defaultValue: "OPEN" },
        carry_forward_expires_on: { type: Sequelize.DATEONLY, allowNull: true },
        carry_forward_used: { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_leave_balances` ADD COLUMN live_key TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED"
    );
    await queryInterface.addIndex("hrms_leave_balances", ["employee_id","leave_type_id","balance_year","live_key"], { unique: true, name: "uq_hrms_leave_balances_employee_id_leave_type_id_balance__e392e3" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_leave_balances");
  },
};
