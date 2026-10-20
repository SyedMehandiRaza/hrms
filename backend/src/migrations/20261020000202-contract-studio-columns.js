"use strict";

const FIELD_TYPES = ["INPUT", "CHECKBOX", "SIGNATURE", "DB_COLUMN"];
const DB_SOURCES = ["EMPLOYEE", "STAFFING_COMPANY", "VENDOR", "CLIENT", "COLLABORATING_COMPANY"];
const ACTIONS = ["CREATED", "UPDATED", "SENT", "VIEWED", "SIGNED", "SUBMITTED", "APPROVED", "DECLINED", "REJECTED", "COMPLETED", "REMINDED", "EXPIRED"];
const FIELD_TABLES = ["hrms_contract_template_fields", "hrms_contract_fields"];

const setFieldEnums = async (queryInterface, Sequelize, fieldTypes, dbSources) => {
  for (const table of FIELD_TABLES) {
    await queryInterface.changeColumn(table, "field_type", { type: Sequelize.ENUM(...fieldTypes), allowNull: false });
    await queryInterface.changeColumn(table, "db_source", { type: Sequelize.ENUM(...dbSources), allowNull: true });
  }
};

// Plan decision 46: additive changes on the contract tables other than hrms_contracts
// and the templates' type (separate migrations).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("hrms_contract_documents", "file_sha256", { type: Sequelize.CHAR(64), allowNull: true });

    await setFieldEnums(queryInterface, Sequelize, [...FIELD_TYPES, "DATE", "INITIALS"], [...DB_SOURCES, "CONTRACT"]);

    await queryInterface.changeColumn("hrms_contract_recipients", "reject_reason", { type: Sequelize.STRING(500), allowNull: true });
    await queryInterface.addColumn("hrms_contract_recipients", "signed_ip", { type: Sequelize.STRING(64), allowNull: true });
    await queryInterface.addColumn("hrms_contract_recipients", "signed_user_agent", { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn("hrms_contract_recipients", "evidence", { type: Sequelize.JSON, allowNull: true });

    await queryInterface.changeColumn("hrms_contract_activities", "action", { type: Sequelize.ENUM(...ACTIONS, "REVOKED"), allowNull: false });

    // Case-insensitive through the utf8mb4_unicode_ci collation (decision 15).
    await queryInterface.addIndex("hrms_contract_types", ["employer_id", "name"], { unique: true, name: "uq_hrms_contract_types_employer_id_name" });
  },

  async down(queryInterface, Sequelize) {
    // Rows using the new enum values can't exist in the old schema and are dropped when undoing.
    const run = (sql) => queryInterface.sequelize.query(sql);
    await run("DELETE FROM `hrms_contract_activities` WHERE action = 'REVOKED'");
    await run("UPDATE `hrms_contract_recipients` SET reject_reason = LEFT(reject_reason, 255) WHERE CHAR_LENGTH(reject_reason) > 255");
    for (const table of FIELD_TABLES) {
      await run(`DELETE FROM \`${table}\` WHERE field_type IN ('DATE','INITIALS') OR db_source = 'CONTRACT'`);
    }
    await queryInterface.removeIndex("hrms_contract_types", "uq_hrms_contract_types_employer_id_name");

    await queryInterface.changeColumn("hrms_contract_activities", "action", { type: Sequelize.ENUM(...ACTIONS), allowNull: false });

    await queryInterface.removeColumn("hrms_contract_recipients", "evidence");
    await queryInterface.removeColumn("hrms_contract_recipients", "signed_user_agent");
    await queryInterface.removeColumn("hrms_contract_recipients", "signed_ip");
    await queryInterface.changeColumn("hrms_contract_recipients", "reject_reason", { type: Sequelize.STRING(255), allowNull: true });

    await setFieldEnums(queryInterface, Sequelize, FIELD_TYPES, DB_SOURCES);

    await queryInterface.removeColumn("hrms_contract_documents", "file_sha256");
  },
};
