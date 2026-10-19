"use strict";

// Password reset (ADR 0001): a verified code hands out a single-use reset token,
// stored only as its SHA-256 and valid for 15 minutes.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("password_reset_otps", "reset_token_hash", {
      type: Sequelize.CHAR(64),
      allowNull: true,
      after: "consumed_at",
    });
    await queryInterface.addColumn("password_reset_otps", "reset_token_expires_at", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "reset_token_hash",
    });
    await queryInterface.addIndex("password_reset_otps", ["reset_token_hash"], {
      name: "ux_password_reset_otps_reset_token_hash",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("password_reset_otps", "ux_password_reset_otps_reset_token_hash");
    await queryInterface.removeColumn("password_reset_otps", "reset_token_expires_at");
    await queryInterface.removeColumn("password_reset_otps", "reset_token_hash");
  },
};
