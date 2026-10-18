import { generateYearReports } from "../../data/groupG";

// Annual reports are generated at once in the static build: the "job" comes
// back already DONE. Same signatures as before, reporting the final state to
// `onProgress`. Resolves with the final job.

export const isJobRunning = (job) => !!job && job.status === "RUNNING";

export async function pollReportJob(yearKey, job, { onProgress } = {}) {
  const cur = job || null;
  if (cur) onProgress?.(cur);
  return cur;
}

export async function runReportJob(yearKey, payload, opts = {}) {
  return pollReportJob(yearKey, generateYearReports(yearKey, payload), opts);
}

// No job is ever left running.
export async function runningReportJob() {
  return null;
}
