# 13: Expiry, reminder and inactive-recipient job

**What to build:** An hourly job that expires overdue contracts, sends the 2-day reminder once, and auto-revokes
contracts of recipients who left. It only reads employee and staffing status (plan decisions 36, 41, ADR 0008).

**Blocked by:** 08 Send contracts (single and bulk)

**Status:** ready-for-agent

- [ ] When the system (job) runs and a SENT or VIEWED contract is past its expiry → it becomes EXPIRED with an
      EXPIRED activity and no actor.
- [ ] When a SUBMITTED contract is past its sign-by date → the job leaves it alone.
- [ ] When a Riyadh company's contract has sign-by today and the job runs at 23:00 Riyadh time → it isn't expired;
      at 00:05 the next day → it is.
- [ ] When a SENT or VIEWED contract's expiry is within 48 hours and it was sent more than 48 hours before its
      expiry → one reminder is recorded (REMINDED activity and reminder time); when the job runs again → no second
      reminder.
- [ ] When a contract was sent with less than 48 hours to its expiry → no reminder is ever recorded.
- [ ] When a SUBMITTED contract is within 48 hours of its sign-by time → no reminder.
- [ ] When a SENT, VIEWED or SUBMITTED contract's employee is exited or deleted, or their account has ended, or
      the staffing company is inactive, deleted, has no login, or its login's account in this company has ended → it
      becomes REVOKED with reason "Recipient is no longer active." and no actor.
- [ ] When the employee is IN_NOTICE, or the recipient's account is suspended → their contracts are untouched.
- [ ] When a contract is COMPLETED, REJECTED or already in an end state → the job never changes it.
- [ ] When two job runs overlap, or the job and a request's lazy expiry hit the same contract → each contract is
      changed once, with one EXPIRED activity.
- [ ] When tests call the job directly → it runs without waiting for the schedule.
