"use strict";

const STATUS = ["DRAFT", "SENT", "VIEWED", "SUBMITTED", "APPROVED", "REJECTED", "EXPIRED", "COMPLETED"];
const TYPE_FK = "fk_hrms_contracts_contract_type_id";

// Name of the foreign key on a hrms_contracts column (MySQL generates it at create time).
const foreignKeyOf = async (queryInterface, column) => {
  const [rows] = await queryInterface.sequelize.query(
    "SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE " +
      "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hrms_contracts' AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
    { replacements: [column] }
  );
  return rows[0].name;
};

const setTypeForeignKey = async (queryInterface, onDelete) => {
  await queryInterface.removeConstraint("hrms_contracts", await foreignKeyOf(queryInterface, "contract_type_id"));
  await queryInterface.addConstraint("hrms_contracts", {
    fields: ["contract_type_id"],
    type: "foreign key",
    name: TYPE_FK,
    references: { table: "hrms_contract_types", field: "id" },
    onDelete,
  });
};

// Plan decision 46. One active (SENT/VIEWED/SUBMITTED, not deleted) contract per company,
// type and recipient: active_key is NULL otherwise, and MySQL unique keys ignore NULLs.
// MySQL refuses a STORED generated column over a SET NULL foreign key, so the type key
// becomes RESTRICT first (types in use can't be deleted anyway, decision 15).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("hrms_contracts", "status", {
      type: Sequelize.ENUM(...STATUS, "REVOKED"),
      allowNull: false,
      defaultValue: "DRAFT",
    });
    await queryInterface.addColumn("hrms_contracts", "revoke_reason", { type: Sequelize.STRING(500), allowNull: true });
    await queryInterface.addColumn("hrms_contracts", "revoked_at", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("hrms_contracts", "revoked_by", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("hrms_contracts", "rate", { type: Sequelize.DECIMAL(12, 2), allowNull: true });
    await queryInterface.addColumn("hrms_contracts", "rate_unit", {
      type: Sequelize.ENUM("HOURLY", "DAILY", "MONTHLY", "ANNUAL"),
      allowNull: true,
    });
    await queryInterface.addColumn("hrms_contracts", "currency", { type: Sequelize.CHAR(3), allowNull: false, defaultValue: "SAR" });
    await queryInterface.addColumn("hrms_contracts", "notice_period_days", { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn("hrms_contracts", "recipient_key", { type: Sequelize.STRING(40), allowNull: true });
    await queryInterface.addColumn("hrms_contracts", "values_sha256", { type: Sequelize.CHAR(64), allowNull: true });
    await queryInterface.addColumn("hrms_contracts", "signed_pdf_path", { type: Sequelize.STRING(512), allowNull: true });
    await queryInterface.addColumn("hrms_contracts", "signed_pdf_sha256", { type: Sequelize.CHAR(64), allowNull: true });
    await queryInterface.addColumn("hrms_contracts", "reminder_sent_at", { type: Sequelize.DATE, allowNull: true });

    await setTypeForeignKey(queryInterface, "RESTRICT");
    await queryInterface.sequelize.query(
      "ALTER TABLE `hrms_contracts` ADD COLUMN active_key VARCHAR(80) GENERATED ALWAYS AS (" +
        "IF(status IN ('SENT','VIEWED','SUBMITTED') AND deleted_at IS NULL, CONCAT(contract_type_id, '|', recipient_key), NULL)" +
        ") STORED"
    );
    await queryInterface.addIndex("hrms_contracts", ["employer_id", "active_key"], { unique: true, name: "uq_hrms_contracts_employer_id_active_key" });
    await queryInterface.addIndex("hrms_contracts", ["status", "expires_at"], { name: "ix_hrms_contracts_status_expires_at" });
  },

  async down(queryInterface, Sequelize) {
    // REVOKED can't exist in the old schema: those contracts (and their recipients, fields
    // and activities, by cascade) are dropped when undoing.
    await queryInterface.sequelize.query("DELETE FROM `hrms_contracts` WHERE status = 'REVOKED'");
    await queryInterface.removeIndex("hrms_contracts", "ix_hrms_contracts_status_expires_at");
    await queryInterface.removeIndex("hrms_contracts", "uq_hrms_contracts_employer_id_active_key");
    await queryInterface.removeColumn("hrms_contracts", "active_key");
    await setTypeForeignKey(queryInterface, "SET NULL");

    await queryInterface.removeConstraint("hrms_contracts", await foreignKeyOf(queryInterface, "revoked_by"));
    for (const column of [
      "reminder_sent_at",
      "signed_pdf_sha256",
      "signed_pdf_path",
      "values_sha256",
      "recipient_key",
      "notice_period_days",
      "currency",
      "rate_unit",
      "rate",
      "revoked_by",
      "revoked_at",
      "revoke_reason",
    ]) {
      await queryInterface.removeColumn("hrms_contracts", column);
    }
    await queryInterface.changeColumn("hrms_contracts", "status", {
      type: Sequelize.ENUM(...STATUS),
      allowNull: false,
      defaultValue: "DRAFT",
    });
  },
};
