# 05: Project assign / remove API

**What to build:** From a project, admins add employees as a secondary project and take them off (D13, D14).

**Blocked by:** 04 Projects API

**Status:** ready-for-agent

Tests create employees as fixtures (the create API arrives in 13a).

- [ ] When a user with `project:update` assigns two employees → both get the project as secondary from today, with
      ASSIGNED history rows.
- [ ] Assigning someone already on the project changes nothing and is not an error.
- [ ] An empty list → 400 `VALIDATION_FAILED`, employeeIds "Select at least one employee to assign".
- [ ] Assigning to an ON_HOLD or COMPLETED project → 409 `PROJECT_NOT_ACTIVE` "Only active projects can take new employees."
- [ ] Assigning a GENERAL_EMPLOYEE who already has a project → 409 `PROJECT_GENERAL_EMPLOYEE_SINGLE`
      "General employees can belong to only one project."
- [ ] Assigning an IN_NOTICE or EXITED employee → 400 `VALIDATION_FAILED`, employeeIds "In-notice or exited employees
      can't be assigned."; nobody in that request is assigned.
- [ ] Removing a secondary project → the assignment ends today with a REMOVED row.
- [ ] Removing the employee's main project → 409 `PROJECT_REMOVE_MAIN`
      "This is the employee's main project. Change their main project first."
- [ ] The workforce list shows each employee's role, type, staffing company and employment status (Active / In notice).
- [ ] Employees of another company → `NOT_FOUND`; no `project:update` → `FORBIDDEN`.
