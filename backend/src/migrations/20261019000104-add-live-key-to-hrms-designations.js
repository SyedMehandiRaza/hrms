"use strict";

// Plan D32: designation names are unique per department and codes per company, among live
// rows only. live_key is NULL once soft-deleted, so deleted names/codes can be reused
// (MySQL unique keys ignore NULLs, so many designations may also have no code).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_designations` ADD COLUMN live_key TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED"
    );
    // New keys first: the old one also serves the employer_id foreign key.
    await queryInterface.addIndex("hrms_designations", ["employer_id","department_id","name","live_key"], { unique: true, name: "uq_hrms_designations_employer_id_department_id_name_live_key" });
    await queryInterface.addIndex("hrms_designations", ["employer_id","code","live_key"], { unique: true, name: "uq_hrms_designations_employer_id_code_live_key" });
    await queryInterface.removeIndex("hrms_designations", "uq_hrms_designations_employer_id_department_id_name");
  },

  async down(queryInterface) {
    // The old key has no live_key, so soft-deleted rows that reused a name would block it.
    // Rename only those deleted rows (name + " #" + id stays within 150 chars and is unique).
    await queryInterface.sequelize.query(
      "UPDATE `hrms_designations` d JOIN (SELECT employer_id, department_id, name FROM `hrms_designations` GROUP BY employer_id, department_id, name HAVING COUNT(*) > 1) dup " +
        "ON dup.employer_id = d.employer_id AND dup.department_id = d.department_id AND dup.name = d.name " +
        "SET d.name = CONCAT(LEFT(d.name, 112), ' #', d.id) WHERE d.deleted_at IS NOT NULL"
    );
    await queryInterface.addIndex("hrms_designations", ["employer_id","department_id","name"], { unique: true, name: "uq_hrms_designations_employer_id_department_id_name" });
    await queryInterface.removeIndex("hrms_designations", "uq_hrms_designations_employer_id_code_live_key");
    await queryInterface.removeIndex("hrms_designations", "uq_hrms_designations_employer_id_department_id_name_live_key");
    await queryInterface.removeColumn("hrms_designations", "live_key");
  },
};
