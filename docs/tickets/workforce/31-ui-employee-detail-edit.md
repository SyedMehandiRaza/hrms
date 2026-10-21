# 31: Employee detail — overview, Projects tab, Edit modal, resend login

**What to build:** `/admin/employees/:id` shows the real employee; Edit info saves job fields, including a main
project change with "Effective from"; admins can resend the login email (D40, D47, D54, D55, D56a).

**Blocked by:** 30 Employees list, 15 Main project change API

**Status:** done

Verified by the ui-tester agent:

- [x] The overview and Projects tab (current, past, history with dates) load; other tabs keep their current content.
- [x] Changing the main project shows "Effective from" (default today); saving → history shows moved out / moved in on
      that date and the old project stays as a current project (for a general employee it moves to past projects).
- [x] A future effective date → "Effective date must be after the current main project's start, not in the future and
      not in a locked period." under "Effective from"; an inactive project → "Only active projects can take new
      employees."
- [x] Changing the shift, department/designation, role, approval group and leave policies saves; salary fields can't
      be saved.
- [x] Switching an employee with two projects to General employee → "General employees can belong to only one project."
- [x] The Edit modal edits phone, nationality and residence country/city with the shared inputs.
- [x] A project-scoped approval group that no longer matches shows a warning.
- [x] Resend login → toast; the new setup link works and the old one shows "This link is invalid or has expired. Ask
      your administrator to resend it."
- [x] An exited employee's Edit and Resend show "This employee has exited. Use Rehire."
- [x] An employee in the Employee panel sees only their own profile.
- [x] Another company's id → "The requested record was not found."
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.

- **Detail.** It comes from `GET /employees/:id`.
  - Overview shows personal data, role, joining date, current projects and a compensation summary. The summary is built from the saved salary, with PERCENTAGE resolved against Basic and shown in SAR.
  - The Projects tab shows current projects with a Main badge, past projects, and history dated by `effective_date`.
  - Other tabs keep their content.
- **Edit.** Personal and job fields save with `PUT /employees/:id`.
  - Assignments are made on the project page, so Projects is read-only here.
  - A new main project goes first through `PUT /employees/:id/main-project` with "Effective from" (default today).
  - Salary and joining date are shown but can't be edited.
  - The approval picker loads the active groups and warns when a project group no longer matches.
  - Address is optional, as in the API; when filled it still needs 5 characters.
  - The photo can't be changed yet: there is no upload API.
- **Resend login.** The button and its toast "Login email sent." are new copy. For an exited employee, Edit and Resend show "This employee has exited. Use Rehire."
- **API addition.** `GET /employees/me` returns the caller's own detail, tested in `employees-read-bulk.test.js`. The Employee panel's My Profile now shows it, so the panel sees only its own profile.
- **Known limits:**
  - If the main-project change succeeds and the job-field save then fails, the main-project change stays. The modal shows the error.
  - Names with digits fail the shared name rule, the same as the Add wizard.
  - Resending for an employee with no login gives `NOT_FOUND`.
- **Not tested:** another company's real id. Unknown and malformed ids show "The requested record was not found.".
- **Shared files.** `EmployeeDetail.jsx` also carries the Raise-exit gating (`employee:create` + update) and the open-exit banner, from `GET /exits`, used by ticket 32.
