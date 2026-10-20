# 31: Employee detail — overview, Projects tab, Edit modal, resend login

**What to build:** `/admin/employees/:id` shows the real employee; Edit info saves job fields, including a main
project change with "Effective from"; admins can resend the login email (D40, D47, D54, D55, D56a).

**Blocked by:** 30 Employees list, 15 Main project change API

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] The overview and Projects tab (current, past, history with dates) load; other tabs keep their current content.
- [ ] Changing the main project shows "Effective from" (default today); saving → history shows moved out / moved in on
      that date and the old project stays as a current project (for a general employee it moves to past projects).
- [ ] A future effective date → "Effective date must be after the current main project's start, not in the future and
      not in a locked period." under "Effective from"; an inactive project → "Only active projects can take new
      employees."
- [ ] Changing the shift, department/designation, role, approval group and leave policies saves; salary fields can't
      be saved.
- [ ] Switching an employee with two projects to General employee → "General employees can belong to only one project."
- [ ] The Edit modal edits phone, nationality and residence country/city with the shared inputs.
- [ ] A project-scoped approval group that no longer matches shows a warning.
- [ ] Resend login → toast; the new setup link works and the old one shows "This link is invalid or has expired. Ask
      your administrator to resend it."
- [ ] An exited employee's Edit and Resend show "This employee has exited. Use Rehire."
- [ ] An employee in the Employee panel sees only their own profile.
- [ ] Another company's id → "The requested record was not found."
- [ ] Lint passes.
