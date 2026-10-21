const cron = require("node-cron");
const { runLwdJob } = require("../services/lwdJob.service");

// Background jobs, started by the server. Off unless JOBS_ENABLED=true, and never in tests (they
// call the jobs directly). Returns the scheduled tasks, or null.
const startJobs = () => {
  if (process.env.NODE_ENV === "test" || process.env.JOBS_ENABLED !== "true") return null;
  // Hourly: each company is processed once its local date has moved on past an LWD (D63).
  const lwd = cron.schedule("0 * * * *", async () => {
    try {
      const { processed, failed } = await runLwdJob();
      if (processed.length || failed.length) console.log(`[lwd-job] processed ${processed.length}, failed ${failed.length}`);
    } catch (err) {
      console.error("[lwd-job] run failed", { error: err.message });
    }
  });
  return [lwd];
};

module.exports = { startJobs };
