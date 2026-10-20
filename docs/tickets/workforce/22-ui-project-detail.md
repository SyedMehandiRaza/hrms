# 22: Project detail + assign / remove

**What to build:** `/admin/projects/project-detail/:id` shows the real project and its workforce, with Assign
Employees and remove (D13–D15).

**Blocked by:** 21 Projects page, full list, create/edit; 05 Project assign / remove API

**Status:** ready-for-agent

Uses the seeded employees (`docs/test-users.md`).

Verified by the ui-tester agent:

- [ ] Description, dates, radius, offline-attendance and location load; attendance summary and payroll cost show an
      empty state.
- [ ] The workforce table shows name, role, type, staffing company and status (Active / In notice), filterable.
- [ ] Assign two employees → toast, both appear; IN_NOTICE and EXITED employees aren't offered.
- [ ] Assigning to an On Hold project → "Only active projects can take new employees."
- [ ] Assigning a general employee who has a project → "General employees can belong to only one project."
- [ ] Remove a secondary member → confirm → gone; removing someone whose main project this is → "This is the
      employee's main project. Change their main project first."
- [ ] Unknown or another company's id → "The requested record was not found."
- [ ] Without `project:update` the Assign and remove buttons are hidden.
- [ ] Lint passes.
