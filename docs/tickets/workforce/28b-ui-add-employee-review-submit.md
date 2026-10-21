# 28b: Add employee wizard — Review, approval group, create

**What to build:** The Review step picks the approval group and creates the employee, with clear success and error
states (D18, D47, D51, D53).

**Blocked by:** 28a Add employee wizard — Basic, Job, Salary + save draft; 31 Employee detail — overview, Projects tab,
Edit modal, resend login

**Status:** done

Note: employee creation has no approval step; "Submit for approval" belongs to the exit wizard (32).

Verified by the ui-tester agent:

- [x] Review shows every entered value; the approval-group section opens in "ALL" mode with the hint "This group
      approves all of this employee's requests."
- [x] In a company with no active approval group, the employee is created without one.
- [x] Once a group exists: creating without a group → "Select an approval group."; a project group for another project →
      "This approval group belongs to a different project."
- [x] Create → toast, redirect to the new employee's detail showing the `EMP-` Employee ID; the welcome email is in the
      outbox.
- [x] Creating from a draft removes it from the Drafts tab.
- [x] A server error on any field takes the user back to that step with the message under the field.
- [x] Double-clicking create creates one employee.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.
- Review lists every entered value. Countries, city and designation are resolved to names, and the phone shows in international format.
- The approval picker opens in "Same group for all" with the D51 hint. It loads the active groups, and project-scoped groups show only for the main project.
- Create sends `POST /employees`. Only "ALL" routing is sent; per-module routing gets the server's answer.
  - Company without groups: the employee is created with no group.
  - A group is required once one exists ("Select an approval group.").
  - A mismatched project group gets "This approval group belongs to a different project.".
- On success the wizard toasts and goes to the new employee's detail (EMP- id). The welcome email appears in the API log.
- A draft is deleted on create via `draft_id`.
- A server error goes back to its step with the message under the field; this was checked with a duplicate email on step 1. Error-to-step routing for other steps uses the same field map.
- A double click sends one request.
- Documents and the photo aren't sent (D44). The Documents step still asks for an Iqama file client-side, as designed.
- Lint is clean on this ticket's files. Repo-wide `npm run lint` still reports errors in untouched static-baseline files (unused imports and so on), as for every other ticket.
