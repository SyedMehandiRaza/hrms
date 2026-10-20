"use strict";

const STATUSES = ["PENDING", "SENT", "VIEWED", "SIGNED", "SUBMITTED", "DECLINED"];
const FINAL = ["COMPLETED", "EXPIRED", "REVOKED"];

const setStatuses = (queryInterface, Sequelize, values) =>
  queryInterface.changeColumn("hrms_contract_recipients", "status", { type: Sequelize.ENUM(...values), allowNull: false, defaultValue: "PENDING" });

// Plan decision 47: a recipient's status follows its contract into COMPLETED, EXPIRED and
// REVOKED (REJECTED already sets DECLINED). Existing rows are backfilled from their contract.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await setStatuses(queryInterface, Sequelize, [...STATUSES, ...FINAL]);
    await queryInterface.sequelize.query(
      "UPDATE `hrms_contract_recipients` r JOIN `hrms_contracts` c ON c.id = r.contract_id " +
        "SET r.status = c.status WHERE c.status IN ('COMPLETED','EXPIRED','REVOKED')"
    );
  },

  async down(queryInterface, Sequelize) {
    // Back to the last step the recipient reached.
    await queryInterface.sequelize.query(
      "UPDATE `hrms_contract_recipients` SET status = CASE " +
        "WHEN submitted_at IS NOT NULL THEN 'SUBMITTED' WHEN viewed_at IS NOT NULL THEN 'VIEWED' ELSE 'SENT' END " +
        "WHERE status IN ('COMPLETED','EXPIRED','REVOKED')"
    );
    await setStatuses(queryInterface, Sequelize, STATUSES);
  },
};
