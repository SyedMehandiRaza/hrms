"use strict";

const { deriveDepartmentCode } = require("../utils/departmentCode");

// Plan D31: department code is required; names and codes are unique per company among
// live rows only. live_key is NULL once soft-deleted, so deleted names/codes can be reused
// (MySQL unique keys ignore NULLs). Case-insensitive through the utf8mb4_unicode_ci collation.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Backfill: code = name uppercased (max 50), with "-2", "-3", ... if taken in the company.
      const [missing] = await queryInterface.sequelize.query(
        "SELECT id, employer_id, name FROM `hrms_departments` WHERE code IS NULL OR TRIM(code) = '' ORDER BY created_at, id",
        { transaction }
      );
      const takenByEmployer = new Map();
      for (const dept of missing) {
        if (!takenByEmployer.has(dept.employer_id)) {
          const [rows] = await queryInterface.sequelize.query(
            "SELECT code FROM `hrms_departments` WHERE employer_id = ? AND code IS NOT NULL AND TRIM(code) <> ''",
            { replacements: [dept.employer_id], transaction }
          );
          takenByEmployer.set(dept.employer_id, rows.map((row) => row.code));
        }
        const taken = takenByEmployer.get(dept.employer_id);
        const code = deriveDepartmentCode(dept.name, taken);
        taken.push(code);
        await queryInterface.sequelize.query("UPDATE `hrms_departments` SET code = ? WHERE id = ?", {
          replacements: [code, dept.id],
          transaction,
        });
      }
    });

    await queryInterface.changeColumn("hrms_departments", "code", { type: Sequelize.STRING(50), allowNull: false });
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_departments` ADD COLUMN live_key TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED"
    );
    // New keys first: the old one also serves the employer_id foreign key.
    await queryInterface.addIndex("hrms_departments", ["employer_id","name","live_key"], { unique: true, name: "uq_hrms_departments_employer_id_name_live_key" });
    await queryInterface.addIndex("hrms_departments", ["employer_id","code","live_key"], { unique: true, name: "uq_hrms_departments_employer_id_code_live_key" });
    await queryInterface.removeIndex("hrms_departments", "uq_hrms_departments_employer_id_name");
  },

  // Backfilled codes are kept: they can't be told apart from codes users entered.
  async down(queryInterface, Sequelize) {
    // The old key has no live_key, so soft-deleted rows that reused a name would block it.
    // Rename only those deleted rows (name + " #" + id stays within 150 chars and is unique).
    await queryInterface.sequelize.query(
      "UPDATE `hrms_departments` d JOIN (SELECT employer_id, name FROM `hrms_departments` GROUP BY employer_id, name HAVING COUNT(*) > 1) dup " +
        "ON dup.employer_id = d.employer_id AND dup.name = d.name " +
        "SET d.name = CONCAT(LEFT(d.name, 112), ' #', d.id) WHERE d.deleted_at IS NOT NULL"
    );
    await queryInterface.addIndex("hrms_departments", ["employer_id","name"], { unique: true, name: "uq_hrms_departments_employer_id_name" });
    await queryInterface.removeIndex("hrms_departments", "uq_hrms_departments_employer_id_code_live_key");
    await queryInterface.removeIndex("hrms_departments", "uq_hrms_departments_employer_id_name_live_key");
    await queryInterface.removeColumn("hrms_departments", "live_key");
    await queryInterface.changeColumn("hrms_departments", "code", { type: Sequelize.STRING(50), allowNull: true });
  },
};
