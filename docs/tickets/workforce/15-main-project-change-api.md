# 15: Main project change API

**What to build:** An admin moves an employee to a new main project from an effective date, keeping a history of
which project they were on for each day (D55).

**Blocked by:** 14b Employee edit API

**Status:** done

- [x] When a user with `employee:update` changes the main project from A to B effective today → B is main, A stays
      as secondary; MOVED_OUT (A) and MOVED_IN (B) rows carry the effective date; A's period ends yesterday and B's
      starts today.
- [x] B not yet assigned → it's added as an assignment.
- [x] For a GENERAL_EMPLOYEE, A's assignment ends the day before the effective date with a REMOVED row, so they stay on
      one project.
- [x] "Which main project on date X?" gives A before the change and B from the effective date.
- [x] A → B → A creates three separate periods.
- [x] B not ACTIVE → 409 `PROJECT_NOT_ACTIVE` "Only active projects can take new employees."
- [x] An effective date in the future, on or before the current period's start, or in a locked period → 400
      `VALIDATION_FAILED`, effectiveFrom "Effective date must be after the current main project's start, not in the
      future and not in a locked period."
- [x] An exited employee → 409 `EMPLOYEE_EXITED` "This employee has exited. Use Rehire."
- [x] A PROJECT-scoped approval group that no longer matches stays and is flagged as mismatched in the detail.
- [x] `FORBIDDEN` without `employee:update`; another company's project → `NOT_FOUND`.

Notes (2026-10-21):
- `PUT /employees/:id/main-project { projectId, effectiveFrom? }` (`employee:update`) returns the employee detail.
- Choosing the current main project changes nothing.
- An effective date that isn't a real date gets the same effectiveFrom error.
- A date is locked when its FY is closed or locked, or when its month is locked for ALL, ATTENDANCE or PAYROLL.
- A project that isn't assigned yet is added from the effective date with a MOVED_IN row only.
- The detail's `approval_group` has `project_mismatch`.
- "Which main project on date X?" is answered by `mainProjectOn(employeeId, date)` in
  `backend/src/services/employeeMainProject.service.js`.
- Tests: `backend/tests/employees-main-project.test.js`.
