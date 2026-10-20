# 15: Main project change API

**What to build:** An admin moves an employee to a new main project from an effective date, keeping a history of
which project they were on for each day (D55).

**Blocked by:** 14b Employee edit API

**Status:** ready-for-agent

- [ ] When a user with `employee:update` changes the main project from A to B effective today → B is main, A stays
      as secondary; MOVED_OUT (A) and MOVED_IN (B) rows carry the effective date; A's period ends yesterday and B's
      starts today.
- [ ] B not yet assigned → it's added as an assignment.
- [ ] For a GENERAL_EMPLOYEE, A's assignment ends the day before the effective date with a REMOVED row, so they stay on
      one project.
- [ ] "Which main project on date X?" gives A before the change and B from the effective date.
- [ ] A → B → A creates three separate periods.
- [ ] B not ACTIVE → 409 `PROJECT_NOT_ACTIVE` "Only active projects can take new employees."
- [ ] An effective date in the future, on or before the current period's start, or in a locked period → 400
      `VALIDATION_FAILED`, effectiveFrom "Effective date must be after the current main project's start, not in the
      future and not in a locked period."
- [ ] An exited employee → 409 `EMPLOYEE_EXITED` "This employee has exited. Use Rehire."
- [ ] A PROJECT-scoped approval group that no longer matches stays and is flagged as mismatched in the detail.
- [ ] `FORBIDDEN` without `employee:update`; another company's project → `NOT_FOUND`.
