# 19: Rehire API

**What to build:** An exited employee who is eligible can be rehired on the same record and Employee ID (D67).

**Blocked by:** 18 Last-working-day daily job, 13b At-create setup

**Status:** done

Field texts: `docs/standards.md` §7.2 "Rehire" (and "Employee (create, edit)" for overridden job fields).

- [x] When a user with `employee:create` rehires an eligible EXITED employee on or after `rehire_allowed_from` →
      employee ACTIVE, same Employee ID, joining date = rehire date (empty = today); the old exit keeps the original
      dates and gets exit event REHIRED.
- [x] A rehire date more than 90 days ahead → rehireDate "Rehire date cannot be more than 90 days ahead"; an invalid
      date → "Enter a valid rehire date".
- [x] The same account is reactivated and a new temporary password and setup link are emailed.
- [x] Main project: the chosen ACTIVE project, else the last main project if ACTIVE, else mainProjectId
      "Select an active main project."
- [x] Approval group, shift, salary (new row from the rehire date) and leave policies are kept when still active;
      leave balances start fresh per 13b.
- [x] Employment type is kept; role, department, designation and staffing company are kept when still active, else
      cleared (designation cleared with its department); any of them can be overridden under the create rules.
- [x] A former SUB_ADMIN stays SUB_ADMIN when the owner rehires them, and becomes EMPLOYEE when someone else does.
- [x] Secondary projects ended at the LWD are not restored.
- [x] Not rehire-eligible → 409 `REHIRE_NOT_ELIGIBLE` "This employee isn't eligible for rehire."; a date before
      `rehire_allowed_from` → 409 `REHIRE_NOT_ALLOWED` "This employee isn't eligible for rehire until {date}."
- [x] The email has a current account in another company → 409 `ACCOUNT_EMAIL_IN_OTHER_COMPANY`
      "This email is already used by another company."
- [x] Rehiring when the exit isn't EXITED → 409 `EXIT_INVALID_STATE`
      "This action isn't possible in the exit's current status."
- [x] `FORBIDDEN` without `employee:create`; another company's employee → `NOT_FOUND`.

**Implementation notes (2026-10-21):** `POST /exits/:id/rehire` body (all optional): `rehireDate`, `mainProjectId`,
and the job-field overrides `employmentType`, `accessLevel`, `roleId`, `departmentId`, `designationId`,
`staffingCompanyId` (null/"" clears an optional one). Response: the employee summary (as `POST /employees`).
Choices made where the plan is silent: an exit already used for a rehire → `EXIT_INVALID_STATE`; the old salary and
leave assignments end on the exit date; the old balance for a kept leave type in the rehire FY is soft-deleted so a
fresh one can start; a PROJECT approval group for a different main project is dropped (D51); the rehire date must
not be before the main project's start (D49, field `rehireDate`); the employee's `exit_date` is cleared (the exit
row keeps it).
