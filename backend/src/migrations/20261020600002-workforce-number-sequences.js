"use strict";

const crypto = require("crypto");
const { setForeignKey } = require("../utils/migrations");

// Number sequences (docs/plans/workforce-and-lifecycle.md D10, D45, §3): + PROJECT (per company
// per financial year) and EMPLOYEE (per company, no year: one row with financial_year_id NULL).
// The unique key goes through fy_key = IFNULL(financial_year_id, '') so NULL years can't
// duplicate (VIRTUAL: MySQL refuses a STORED column on a CASCADE foreign key). An existing company's EMPLOYEE sequence starts at its highest "EMP-<n>" code.

const OLD_TYPES = ["STAFFING_BILL", "LOAN", "CONTRACT", "PAYROLL_RUN"];
const NEW_TYPES = [...OLD_TYPES, "PROJECT", "EMPLOYEE"];

// Each company with "EMP-<n>" codes and no EMPLOYEE sequence yet gets one at its highest n
// (codes are never reused). Returns how many were started.
const startEmployeeSequences = async (sequelize, { transaction } = {}) => {
  const [rows] = await sequelize.query(
    `SELECT e.employer_id, MAX(CAST(SUBSTRING(e.employee_code, 5) AS UNSIGNED)) AS last_no FROM employees e
     WHERE e.employee_code REGEXP '^EMP-[0-9]+$'
       AND NOT EXISTS (SELECT 1 FROM hrms_number_sequences s WHERE s.employer_id = e.employer_id AND s.doc_type = 'EMPLOYEE')
     GROUP BY e.employer_id`,
    { transaction }
  );
  const now = new Date();
  for (const row of rows) {
    await sequelize.query(
      `INSERT INTO hrms_number_sequences (id, employer_id, doc_type, financial_year_id, last_no, created_at, updated_at)
       VALUES (?, ?, 'EMPLOYEE', NULL, ?, ?, ?)`,
      { replacements: [crypto.randomUUID(), row.employer_id, Number(row.last_no), now, now], transaction }
    );
  }
  return rows.length;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("hrms_number_sequences", "doc_type", { type: Sequelize.ENUM(...NEW_TYPES), allowNull: false });
    await setForeignKey(queryInterface, {
      table: "hrms_number_sequences",
      column: "financial_year_id",
      references: "hrms_financial_years",
      nullable: true,
      onDelete: "CASCADE",
      name: "fk_hrms_number_sequences_financial_year_id",
    });
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_number_sequences` ADD COLUMN fy_key CHAR(36) GENERATED ALWAYS AS (IFNULL(financial_year_id, '')) VIRTUAL"
    );
    await queryInterface.addIndex("hrms_number_sequences", ["employer_id", "doc_type", "fy_key"], {
      unique: true,
      name: "uq_hrms_number_sequences_employer_id_doc_type_fy_key",
    });
    await queryInterface.removeIndex("hrms_number_sequences", "uq_hrms_number_sequences_employer_id_doc_type_financial_year_id");

    const started = await startEmployeeSequences(queryInterface.sequelize);
    console.log(`[workforce] EMPLOYEE sequences started for ${started} company(ies)`);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "DELETE FROM hrms_number_sequences WHERE doc_type IN ('PROJECT', 'EMPLOYEE') OR financial_year_id IS NULL"
    );
    await queryInterface.addIndex("hrms_number_sequences", ["employer_id", "doc_type", "financial_year_id"], {
      unique: true,
      name: "uq_hrms_number_sequences_employer_id_doc_type_financial_year_id",
    });
    await queryInterface.removeIndex("hrms_number_sequences", "uq_hrms_number_sequences_employer_id_doc_type_fy_key");
    await queryInterface.removeColumn("hrms_number_sequences", "fy_key");
    await setForeignKey(queryInterface, {
      table: "hrms_number_sequences",
      column: "financial_year_id",
      references: "hrms_financial_years",
      nullable: false,
      onDelete: "CASCADE",
      name: "fk_hrms_number_sequences_financial_year_id",
    });
    await queryInterface.changeColumn("hrms_number_sequences", "doc_type", { type: Sequelize.ENUM(...OLD_TYPES), allowNull: false });
  },

  startEmployeeSequences,
};
