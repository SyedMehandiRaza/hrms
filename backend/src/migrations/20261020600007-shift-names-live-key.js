"use strict";

// Shift names are unique per company among live rows (standards §5, workforce D35, D37): a
// soft-deleted shift's name can be used again. live_key is NULL once soft-deleted.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `company_shifts` ADD COLUMN live_key TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED"
    );
    // New key first: the old one also serves the employer_id foreign key.
    await queryInterface.addIndex("company_shifts", ["employer_id", "name", "live_key"], {
      unique: true,
      name: "uq_company_shifts_employer_id_name_live_key",
    });
    await queryInterface.removeIndex("company_shifts", "uq_company_shifts_employer_id_name");
  },

  // Deleted rows that reused a name would block the old key: rename only those.
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE `company_shifts` s JOIN (SELECT employer_id, name FROM `company_shifts` GROUP BY employer_id, name HAVING COUNT(*) > 1) dup " +
        "ON dup.employer_id = s.employer_id AND dup.name = s.name " +
        "SET s.name = CONCAT(LEFT(s.name, 12), ' #', s.id) WHERE s.deleted_at IS NOT NULL"
    );
    await queryInterface.addIndex("company_shifts", ["employer_id", "name"], { unique: true, name: "uq_company_shifts_employer_id_name" });
    await queryInterface.removeIndex("company_shifts", "uq_company_shifts_employer_id_name_live_key");
    await queryInterface.removeColumn("company_shifts", "live_key");
  },
};
