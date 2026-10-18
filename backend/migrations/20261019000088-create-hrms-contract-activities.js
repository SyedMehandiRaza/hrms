"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "hrms_contract_activities",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        contract_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_contracts", key: "id" }, onDelete: "CASCADE" },
        recipient_id: { type: Sequelize.UUID, allowNull: true, references: { model: "hrms_contract_recipients", key: "id" }, onDelete: "SET NULL" },
        action: { type: Sequelize.ENUM("CREATED", "UPDATED", "SENT", "VIEWED", "SIGNED", "SUBMITTED", "APPROVED", "DECLINED", "REJECTED", "COMPLETED", "REMINDED", "EXPIRED"), allowNull: false },
        actor_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        description: { type: Sequelize.STRING(255), allowNull: true },
        meta: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("hrms_contract_activities", ["employer_id","created_at"], { name: "ix_hrms_contract_activities_employer_id_created_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("hrms_contract_activities");
  },
};
