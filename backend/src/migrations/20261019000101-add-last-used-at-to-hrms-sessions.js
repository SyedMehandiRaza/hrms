"use strict";

// Sessions list (plan D14): when the session was last used (login or refresh).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("hrms_sessions", "last_used_at", { type: Sequelize.DATE, allowNull: true, after: "expires_at" });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("hrms_sessions", "last_used_at");
  },
};
