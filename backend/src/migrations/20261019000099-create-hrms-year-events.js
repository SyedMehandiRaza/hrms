"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_year_events",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        financial_year_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_financial_years", key: "id" }, onDelete: "CASCADE" },
        event_type: { type: Sequelize.ENUM("OPENED", "AUTO_OPENED", "REVIEW_STARTED", "READINESS_CHECKED", "LEAVE_CLOSED", "LEAVE_OVERRIDE", "HOLIDAYS_COPIED", "WEEKOFFS_COPIED", "POLICY_VERSIONED", "INCREMENT_APPLIED", "INCREMENT_REVERTED", "REPORTS_GENERATED", "MONTH_LOCKED", "MONTH_UNLOCKED", "CLOSED", "REOPENED"), allowNull: false },
        payload: { type: Sequelize.JSON, allowNull: true },
        actor_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_year_events", ["financial_year_id","created_at"], { name: "ix_hrms_year_events_financial_year_id_created_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_year_events");
  },
};
