# 36: End-to-end workforce lifecycle

**What to build:** One browser run proves the whole flow works together, from setting up a new company's first
employees to rehiring an exited employee.

**Blocked by:** all other tickets in `workforce/` (01–35)

**Status:** done

Verified by the ui-tester agent, in one fresh company (signed up during the run, no seeds):

- [x] Owner creates a head office → a project on it → a shift → a leave policy → a non-default salary component.
- [x] With no approval group yet, owner creates two approver employees (no role, no group); each gets the welcome
      email, sets a password and logs in.
- [x] Owner creates a two-level approval group with one of them per level (cooling period in Exit settings set to 0).
- [x] Owner creates the subject employee with that project, shift, leave policy, salary (Basic, Housing, Transport)
      and the group; the welcome email arrives and the employee sets a password and logs in.
- [x] Owner adds a second project and changes the main project with today's date; history shows the move.
- [x] Owner raises a termination: Pending approval; no email reaches the employee while it's pending.
- [x] L1 approver rejects with a reason → Rejected; owner raises it again.
- [x] L1 approves → L2's inbox; L2 approves → In notice; the employee is emailed.
- [x] The termination is raised with a backdated notice start (a few days ago); owner edits the terms to an LWD of
      yesterday → Exited at once; the employee's next request shows "Your account is
      inactive. Contact your administrator." Then `npm run job:lwd` runs and changes nothing more.
- [x] Owner rehires today → Active, same Employee ID, new setup link works.
- [x] A second company never sees any of this data.

Notes (2026-10-21, PASS): ui-tester ran the whole flow in Edge (playwright-core) in one company signed up during the run ("Zenith Builders"). It used its own API and UI on 5190/5191, with the console mailer logged to a file. Every step went through the UI.

- **Setup.** Head office, project, shift, leave policy and a non-default component were created. The two approvers got the welcome email, set a password and logged in. The subject employee was created with the two-level group, Basic / Housing / Transport and cooling 0.
- **Main project change.** The second project was assigned on the project page and made the main project from today. The history shows ASSIGNED, MOVED IN and MOVED OUT. A head office holds one project, so the second project used a second head office.
- **Approvals.**
  - The raise sent no email to the subject while pending.
  - L1 rejected with a reason; the exit showed Rejected and the owner was emailed. It was raised again.
  - L1 approved, then L2, giving In notice. The subject got "Your employment is ending".
- **Step "LWD of yesterday".** D62 keeps the LWD on or after the notice start, and the wizard's default start is today. So the run raised the termination with a notice start a few days back, then edited the LWD to yesterday: the exit was Exited at once. The employee's next login gets "Your account is inactive. Contact your administrator.". `npm run job:lwd` then processed 0 exits.
- **Rehire.** Rehire today kept EMP-0003, the new setup link worked and the employee is Active.
- **Isolation.** A second company sees none of the data. Its direct links to the first company's ids give "The requested record was not found.".
- **Fixed after the run:**
  - The exit header no longer repeats the status (exit and employment badges).
  - An LWD moved earlier shows as "Moved earlier by n days" / "Last working day moved earlier".
- **Static, outside this plan:** the Employee-panel dashboard, the projects and leave-policy stat cards, and the employee "Recent Activity" still show mock data.
