"use strict";

const { addStarterSalaryComponents } = require("../utils/starterSalaryComponents");

// Every existing company gets the starter salary components it doesn't have yet
// (docs/plans/workforce-and-lifecycle.md D42); a code or name it already uses is skipped.
// Existing BASIC / HOUSING / TRANSPORT / HOURLY rows are marked as defaults / system.

const addToEveryCompany = async (sequelize, transaction) => {
  const employers = await sequelize.query("SELECT id FROM employers", { transaction, type: sequelize.QueryTypes.SELECT });
  let added = 0;
  for (const { id } of employers) added += (await addStarterSalaryComponents(sequelize, id, { transaction })).length;
  await sequelize.query(
    "UPDATE hrms_salary_components SET is_default = 1, is_system = 1 WHERE code IN ('BASIC', 'HOUSING', 'TRANSPORT')",
    { transaction }
  );
  await sequelize.query("UPDATE hrms_salary_components SET is_system = 1 WHERE code = 'HOURLY'", { transaction });
  return { companies: employers.length, added };
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { companies, added } = await queryInterface.sequelize.transaction((transaction) =>
      addToEveryCompany(queryInterface.sequelize, transaction)
    );
    console.log(`[workforce] starter salary components: ${added} added across ${companies} company(ies)`);
  },

  // Components may already be on salaries; they're kept.
  async down() {},

  addToEveryCompany,
};
