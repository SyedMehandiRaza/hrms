const { sequelize, EmployeeExit } = require("../models");
const { clock, dateInZone } = require("../utils/clock");
const { companyTimezone } = require("./companyTime.service");
const { processIfDue } = require("./exitProcess.service");

// The last-working-day job (docs/plans/workforce-and-lifecycle.md D63): per company, on its own
// time zone, every IN_NOTICE exit whose LWD is before the company's local today is processed, one
// transaction each. A failure on one exit is logged and retried on the next run; the others go on.
// Idempotent: a processed exit is no longer IN_NOTICE. Returns { processed, failed } exit ids.
const runLwdJob = async ({ now = clock.now() } = {}) => {
  const open = await EmployeeExit.findAll({ where: { status: "IN_NOTICE" }, attributes: ["id", "employer_id", "last_working_day"] });
  const byCompany = new Map();
  for (const exit of open) byCompany.set(exit.employer_id, [...(byCompany.get(exit.employer_id) || []), exit]);

  const processed = [];
  const failed = [];
  for (const [employerId, exits] of byCompany) {
    const today = dateInZone(now, await companyTimezone(employerId));
    for (const exit of exits.filter((e) => e.last_working_day < today)) {
      try {
        if (await sequelize.transaction((transaction) => processIfDue(exit.id, today, { transaction, now }))) processed.push(exit.id);
      } catch (err) {
        console.error("[lwd-job] could not process exit", { exitId: exit.id, error: err.message });
        failed.push(exit.id);
      }
    }
  }
  return { processed, failed };
};

module.exports = { runLwdJob };
