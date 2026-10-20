"use strict";

// Employee phones are unique per company, not globally (workforce D46, decided 2026-10-21): the
// same number may belong to employees of two companies. users.phone_number keeps a plain index
// for the per-company lookup; the uniqueness check lives in the employee service.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("users", ["phone_number"], { name: "idx_users_phone_number" });
    await queryInterface.removeIndex("users", "uq_users_phone_number");
  },

  // A number shared by several people stays only on the earliest one, so the old key fits.
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE `users` u JOIN (SELECT phone_number, MIN(created_at) AS first_at FROM `users` WHERE phone_number IS NOT NULL " +
        "GROUP BY phone_number HAVING COUNT(*) > 1) dup ON dup.phone_number = u.phone_number " +
        "SET u.phone_number = NULL, u.phone_country = NULL WHERE u.created_at > dup.first_at"
    );
    await queryInterface.sequelize.query(
      "UPDATE `users` u JOIN (SELECT phone_number, MIN(id) AS keep_id FROM `users` WHERE phone_number IS NOT NULL " +
        "GROUP BY phone_number HAVING COUNT(*) > 1) dup ON dup.phone_number = u.phone_number " +
        "SET u.phone_number = NULL, u.phone_country = NULL WHERE u.id <> dup.keep_id"
    );
    await queryInterface.addIndex("users", ["phone_number"], { unique: true, name: "uq_users_phone_number" });
    await queryInterface.removeIndex("users", "idx_users_phone_number");
  },
};
