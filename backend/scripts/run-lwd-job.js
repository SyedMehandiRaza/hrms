// Runs the last-working-day job once (`npm run job:lwd`), for dev and the ui-tester.
const db = require("../src/models");
const { runLwdJob } = require("../src/services/lwdJob.service");

runLwdJob()
  .then(({ processed, failed }) => {
    console.log(`[lwd-job] processed ${processed.length} exit(s), failed ${failed.length}`);
    process.exitCode = failed.length ? 1 : 0;
  })
  .catch((err) => {
    console.error("[lwd-job] run failed", err);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
