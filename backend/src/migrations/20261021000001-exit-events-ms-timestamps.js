"use strict";

// Exit events are the exit's timeline, ordered by created_at (workforce D59): with whole seconds a
// RAISED and an APPROVED in the same second come back in any order, so keep milliseconds.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("ALTER TABLE `hrms_exit_events` MODIFY created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("ALTER TABLE `hrms_exit_events` MODIFY created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  },
};
