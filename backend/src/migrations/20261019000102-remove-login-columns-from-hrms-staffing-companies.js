"use strict";

// Plan D22 / ADR 0003: login state lives on users + hrms_accounts; these columns were duplicates.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn("hrms_staffing_companies", "must_change_password");
    await queryInterface.removeColumn("hrms_staffing_companies", "login_enabled");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("hrms_staffing_companies", "login_enabled", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true, after: "status" });
    await queryInterface.addColumn("hrms_staffing_companies", "must_change_password", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true, after: "login_enabled" });
  },
};
