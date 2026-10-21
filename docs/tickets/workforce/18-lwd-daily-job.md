# 18: Last-working-day daily job

**What to build:** After an employee's last working day their employment ends automatically: they're EXITED, their
login stops and they're taken off projects, approval groups and department head roles (D59, D63). The same "process
exit" service is reused by final approval (here), edit terms and Confirm Immediate (17).

**Blocked by:** 16b Exit approval outcomes, withdraw, emails

**Status:** done

- [x] `runLwdJob({ now })` processes, per company, IN_NOTICE exits whose LWD is before the company's local today; one
      with LWD = today is untouched.
- [x] The exit and employee become EXITED, exit event EXITED, the employee's exit date is the LWD and
      `rehire_allowed_from` = exit date + cooling days + 1.
- [x] The account becomes INACTIVE and all sessions are revoked: their next request → 403 `AUTH_ACCOUNT_INACTIVE`
      "Your account is inactive. Contact your administrator."; the email can then be used by another company.
- [x] All project assignments and the main period end on the LWD, with REMOVED rows.
- [x] Their approval-group memberships are deactivated; pending requests waiting on them are re-evaluated (skip or
      block per 11b); a level left empty is flagged.
- [x] A department they headed has no head.
- [x] Final approval of an exit whose LWD is already past → processed in the same request, not left for the job.
- [x] Running the job twice changes nothing more; a failure on one exit doesn't stop the others.
- [x] Companies are processed independently, each on its own timezone.
- [x] Scheduling: a `node-cron` hourly tick runs the job when `JOBS_ENABLED=true` (added to `.env.example`; never in
      tests); `npm run job:lwd` runs it once (used in dev and by the ui-tester). **The `.env.example` line is still
      pending — see notes.**

**Notes (2026-10-21):**
- A request with a revoked session of an ended (INACTIVE) account now gets 403 `AUTH_ACCOUNT_INACTIVE` (ADR 0002)
  instead of 401 `AUTH_REQUIRED`. Every other revoked session (incl. a SUSPENDED account from bulk deactivate, as
  14a's tests require) is still 401.
- Exit events now write milliseconds (the 16b column was `DATETIME(3)` but the model sent whole seconds), so the
  timeline order RAISED → APPROVED → EXITED is stable.
- `JOBS_ENABLED=false` must be added to `backend/.env.example` by hand: the agent's permissions block `.env*` files.
