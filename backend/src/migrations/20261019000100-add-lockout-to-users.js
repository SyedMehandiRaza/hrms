"use strict";

// Login lockout (plan D10): consecutive failed logins and the time the lock ends.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "failed_login_attempts", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0, after: "last_seen_at" });
    await queryInterface.addColumn("users", "locked_until", { type: Sequelize.DATE, allowNull: true, after: "failed_login_attempts" });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "locked_until");
    await queryInterface.removeColumn("users", "failed_login_attempts");
  },
};
