"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "shift_week_offs",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        shift_id: { type: Sequelize.UUID, allowNull: false, references: { model: "company_shifts", key: "id" }, onDelete: "CASCADE" },
        employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        off_date: { type: Sequelize.DATEONLY, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("shift_week_offs", ["shift_id","off_date"], { unique: true, name: "uq_shift_week_offs_shift_id_off_date" });
    await queryInterface.addIndex("shift_week_offs", ["employer_id","off_date"], { name: "ix_shift_week_offs_employer_id_off_date" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("shift_week_offs");
  },
};
