"use strict";

const { convertExisting } = require("../utils/phone");

// Existing phone numbers → E.164 + phone country (docs/plans/countries-cities-phones.md D21,
// ADR 0012). Values with a + code are parsed with that code, the others as Saudi numbers.
// Valid ones are rewritten; anything else is left as it is with phone country NULL and listed
// in the report. A rewrite that would duplicate another person's phone (users.phone_number is
// unique) is reported and not applied.

// [table, phone column, phone-country column]
const PHONES = [
  ["users", "phone_number", "phone_country"],
  ["employers", "company_phone_number", "phone_country"],
  ["offices", "office_phone", "phone_country"],
  ["hrms_staffing_companies", "phone", "phone_country"],
  ["hrms_staffing_companies", "contact_person_phone", "contact_person_phone_country"],
];

const convertPhones = async (sequelize, transaction) => {
  const select = (sql, replacements) => sequelize.query(sql, { replacements, transaction, type: sequelize.QueryTypes.SELECT });
  const exec = (sql, replacements) => sequelize.query(sql, { replacements, transaction });
  const report = [];
  let converted = 0;

  for (const [table, column, countryColumn] of PHONES) {
    const rows = await select(
      `SELECT id, ${column} AS phone FROM ${table} WHERE ${column} IS NOT NULL AND TRIM(${column}) <> '' AND ${countryColumn} IS NULL`
    );
    for (const row of rows) {
      const result = convertExisting(row.phone);
      if (!result) {
        report.push({ table, id: row.id, column, value: row.phone, reason: "not a valid number" });
        continue;
      }
      if (table === "users") {
        const [clash] = await select("SELECT id FROM users WHERE phone_number = ? AND id <> ?", [result.e164, row.id]);
        if (clash) {
          report.push({ table, id: row.id, column, value: row.phone, reason: `same number as user ${clash.id}` });
          continue;
        }
      }
      await exec(`UPDATE ${table} SET ${column} = ?, ${countryColumn} = ? WHERE id = ?`, [result.e164, result.country, row.id]);
      converted += 1;
    }
  }
  return { converted, report };
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { converted, report } = await queryInterface.sequelize.transaction((transaction) =>
      convertPhones(queryInterface.sequelize, transaction)
    );
    console.log(`[phones] ${converted} converted to E.164; ${report.length} left as they are`);
    report.forEach((r) => console.log(`[phones] not converted: ${r.table}.${r.column} id=${r.id} value=${JSON.stringify(r.value)} (${r.reason})`));
  },

  // The original formatting isn't kept, so values stay in E.164; only the countries are cleared.
  async down(queryInterface) {
    for (const [table, , countryColumn] of PHONES) {
      await queryInterface.sequelize.query(`UPDATE ${table} SET ${countryColumn} = NULL`);
    }
  },

  convertPhones,
};
