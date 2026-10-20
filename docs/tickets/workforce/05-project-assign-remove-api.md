# 05: Project assign / remove API

**What to build:** From a project, admins add employees as a secondary project and take them off (D13, D14).

**Blocked by:** 04 Projects API

**Status:** done

Tests create employees as fixtures (the create API arrives in 13a).

- [x] When a user with `project:update` assigns two employees → both get the project as secondary from today, with
      ASSIGNED history rows.
- [x] Assigning someone already on the project changes nothing and is not an error.
- [x] An empty list → 400 `VALIDATION_FAILED`, employeeIds "Select at least one employee to assign".
- [x] Assigning to an ON_HOLD or COMPLETED project → 409 `PROJECT_NOT_ACTIVE` "Only active projects can take new employees."
- [x] Assigning a GENERAL_EMPLOYEE who already has a project → 409 `PROJECT_GENERAL_EMPLOYEE_SINGLE`
      "General employees can belong to only one project."
- [x] Assigning an IN_NOTICE or EXITED employee → 400 `VALIDATION_FAILED`, employeeIds "In-notice or exited employees
      can't be assigned."; nobody in that request is assigned.
- [x] Removing a secondary project → the assignment ends today with a REMOVED row.
- [x] Removing the employee's main project → 409 `PROJECT_REMOVE_MAIN`
      "This is the employee's main project. Change their main project first."
- [x] The workforce list shows each employee's role, type, staffing company and employment status (Active / In notice).
- [x] Employees of another company → `NOT_FOUND`; no `project:update` → `FORBIDDEN`.

Notes (2026-10-20): also `GET /projects/:id/employees?search=&status=` (the workforce list, `project:read`) and
`GET /projects/:id/assignable-employees` (ACTIVE employees not on the project, for the Assign modal,
`project:update`). Assigning is all or nothing; someone removed earlier gets their old row back from today (one
row per employee and project). Unknown or other-company employee ids → 404.
