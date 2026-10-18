"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_exit_events",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        exit_id: { type: Sequelize.UUID, allowNull: false, references: { model: "hrms_employee_exits", key: "id" }, onDelete: "CASCADE" },
        event_type: { type: Sequelize.ENUM("RAISED", "TERMS_UPDATED", "LWD_EXTENDED", "LWD_REVERTED", "CHECKLIST_UPDATED", "ITEM_ADDED", "SETTLEMENT_POSTED", "ADJUSTMENT_ADDED", "EXITED", "COMPLETED", "CANCELLED", "REHIRED", "CONFIRMED", "CONFIRMED_WITH_OVERRIDE", "RELIEVED_EARLY", "DOCUMENT_GENERATED", "DOCUMENT_SENT", "CLEARANCE_UPLOADED"), allowNull: false },
        payload: { type: Sequelize.JSON, allowNull: true },
        actor_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_exit_events", ["exit_id","created_at"], { name: "ix_hrms_exit_events_exit_id_created_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_exit_events");
  },
};
