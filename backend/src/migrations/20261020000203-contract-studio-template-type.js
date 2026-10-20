"use strict";

// Plan decision 46: every template gets a contract type. Nullable in the database (the API
// requires it, decision 12). Existing templates are backfilled with their company's EMP type
// (EMPLOYEE audience) or STAFF type (STAFFING_COMPANY audience) when one exists; any other
// template stays without a type and can't be used in the wizard until it is edited.
const BACKFILL = [
  ["EMPLOYEE", "EMP"],
  ["STAFFING_COMPANY", "STAFF"],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("hrms_contract_templates", "contract_type_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "hrms_contract_types", key: "id" },
      onDelete: "RESTRICT",
    });
    for (const [audience, code] of BACKFILL) {
      await queryInterface.sequelize.query(
        "UPDATE `hrms_contract_templates` t JOIN `hrms_contract_types` ct ON ct.employer_id = t.employer_id AND ct.code = ? " +
          "SET t.contract_type_id = ct.id WHERE t.audience_type = ? AND t.contract_type_id IS NULL",
        { replacements: [code, audience] }
      );
    }
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE " +
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hrms_contract_templates' AND COLUMN_NAME = 'contract_type_id' AND REFERENCED_TABLE_NAME IS NOT NULL"
    );
    await queryInterface.removeConstraint("hrms_contract_templates", rows[0].name);
    await queryInterface.removeColumn("hrms_contract_templates", "contract_type_id");
  },
};
