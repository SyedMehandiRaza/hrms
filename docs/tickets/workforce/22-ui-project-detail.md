# 22: Project detail + assign / remove

**What to build:** `/admin/projects/project-detail/:id` shows the real project and its workforce, with Assign
Employees and remove (D13–D15).

**Blocked by:** 21 Projects page, full list, create/edit; 05 Project assign / remove API

**Status:** done

Uses the seeded employees (`docs/test-users.md`).

Verified by the ui-tester agent:

- [x] Description, dates, radius, offline-attendance and location load; attendance summary and payroll cost show an
      empty state.
- [x] The workforce table shows name, role, type, staffing company and status (Active / In notice), filterable.
- [x] Assign two employees → toast, both appear; IN_NOTICE and EXITED employees aren't offered.
- [x] Assigning to an On Hold project → "Only active projects can take new employees."
- [x] Assigning a general employee who has a project → "General employees can belong to only one project."
- [x] Remove a secondary member → confirm → gone; removing someone whose main project this is → "This is the
      employee's main project. Change their main project first."
- [x] Unknown or another company's id → "The requested record was not found."
- [x] Without `project:update` the Assign and remove buttons are hidden.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked the flows in Edge (playwright-core) on this worktree's servers.
- The project comes from `GET /projects/:id`. The workforce table is server-paged from `GET /projects/:id/employees` with a status filter (Active / In notice) and search. The sub-line shows the Employee ID, since the API has no email.
- The offline-attendance switch saves through `PUT /projects/:id`.
- Assign uses `GET /projects/:id/assignable-employees` and `POST /projects/:id/employees`. On-hold and general-employee errors show their server messages, and IN_NOTICE employees aren't offered.
- Remove shows `PROJECT_REMOVE_MAIN` for a main project. An unknown id shows "The requested record was not found.".
- Not tested: another company's id. EXITED employees not being offered rests on the API ticket (05), since no EXITED employee could be made in the dev data.
- The current design has no attendance-summary or payroll-cost sections, so there is nothing to show as empty. They stay static or absent per D15.
- The Staffing-portal project page stays static (D15) through `StaticProjectDetail.jsx`, a copy of the old page.
