# 28b: Add employee wizard — Review, approval group, create

**What to build:** The Review step picks the approval group and creates the employee, with clear success and error
states (D18, D47, D51, D53).

**Blocked by:** 28a Add employee wizard — Basic, Job, Salary + save draft; 31 Employee detail — overview, Projects tab,
Edit modal, resend login

**Status:** ready-for-agent

Note: employee creation has no approval step; "Submit for approval" belongs to the exit wizard (32).

Verified by the ui-tester agent:

- [ ] Review shows every entered value; the approval-group section opens in "ALL" mode with the hint "This group
      approves all of this employee's requests."
- [ ] In a company with no active approval group, the employee is created without one.
- [ ] Once a group exists: creating without a group → "Select an approval group."; a project group for another project →
      "This approval group belongs to a different project."
- [ ] Create → toast, redirect to the new employee's detail showing the `EMP-` Employee ID; the welcome email is in the
      outbox.
- [ ] Creating from a draft removes it from the Drafts tab.
- [ ] A server error on any field takes the user back to that step with the message under the field.
- [ ] Double-clicking create creates one employee.
- [ ] Lint passes.
