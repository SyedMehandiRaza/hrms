"use strict";

// Approval requests (docs/plans/workforce-and-lifecycle.md D18, D26, ADR 0011): a request from an
// employee with no approval group goes to the owner only, so approval_group_id becomes optional;
// and a request records the employee it's about (subject_employee_id), who never decides it.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query("ALTER TABLE `hrms_approval_requests` MODIFY approval_group_id CHAR(36) BINARY NULL");
    await queryInterface.addColumn("hrms_approval_requests", "subject_employee_id", {
      type: Sequelize.UUID,
      allowNull: true,
      after: "entity_id",
      references: { model: "employees", key: "id" },
      onDelete: "SET NULL",
    });
    await queryInterface.sequelize.query("UPDATE hrms_approval_requests SET subject_employee_id = requested_by WHERE subject_employee_id IS NULL");
  },

  // Owner-only requests can't survive a NOT NULL group.
  async down(queryInterface) {
    await queryInterface.removeColumn("hrms_approval_requests", "subject_employee_id");
    await queryInterface.sequelize.query("DELETE FROM hrms_approval_requests WHERE approval_group_id IS NULL");
    await queryInterface.sequelize.query("ALTER TABLE `hrms_approval_requests` MODIFY approval_group_id CHAR(36) BINARY NOT NULL");
  },
};
