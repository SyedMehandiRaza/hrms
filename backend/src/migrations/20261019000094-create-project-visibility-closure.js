"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "project_visibility_closure",
      {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        project_id: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        ancestor_employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        descendant_employer_id: { type: Sequelize.UUID, allowNull: false, references: { model: "employers", key: "id" }, onDelete: "CASCADE" },
        depth: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      },
      { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
    );
    await queryInterface.addIndex("project_visibility_closure", ["project_id","ancestor_employer_id","descendant_employer_id"], { unique: true, name: "uq_project_visibility_closure_project_id_ancestor_employe_14c2cf" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_visibility_closure");
  },
};
