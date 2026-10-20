# 36: End-to-end workforce lifecycle

**What to build:** One browser run proves the whole flow works together, from setting up a new company's first
employees to rehiring an exited employee.

**Blocked by:** all other tickets in `workforce/` (01–35)

**Status:** ready-for-agent

Verified by the ui-tester agent, in one fresh company (signed up during the run, no seeds):

- [ ] Owner creates a head office → a project on it → a shift → a leave policy → a non-default salary component.
- [ ] With no approval group yet, owner creates two approver employees (no role, no group); each gets the welcome
      email, sets a password and logs in.
- [ ] Owner creates a two-level approval group with one of them per level (cooling period in Exit settings set to 0).
- [ ] Owner creates the subject employee with that project, shift, leave policy, salary (Basic, Housing, Transport)
      and the group; the welcome email arrives and the employee sets a password and logs in.
- [ ] Owner adds a second project and changes the main project with today's date; history shows the move.
- [ ] Owner raises a termination: Pending approval; no email reaches the employee while it's pending.
- [ ] L1 approver rejects with a reason → Rejected; owner raises it again.
- [ ] L1 approves → L2's inbox; L2 approves → In notice; the employee is emailed.
- [ ] Owner edits the terms to an LWD of yesterday → Exited at once; the employee's next request shows "Your account is
      inactive. Contact your administrator." Then `npm run job:lwd` runs and changes nothing more.
- [ ] Owner rehires today → Active, same Employee ID, new setup link works.
- [ ] A second company never sees any of this data.
