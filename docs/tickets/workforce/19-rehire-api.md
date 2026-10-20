# 19: Rehire API

**What to build:** An exited employee who is eligible can be rehired on the same record and Employee ID (D67).

**Blocked by:** 18 Last-working-day daily job, 13b At-create setup

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Rehire" (and "Employee (create, edit)" for overridden job fields).

- [ ] When a user with `employee:create` rehires an eligible EXITED employee on or after `rehire_allowed_from` →
      employee ACTIVE, same Employee ID, joining date = rehire date (empty = today); the old exit keeps the original
      dates and gets exit event REHIRED.
- [ ] A rehire date more than 90 days ahead → rehireDate "Rehire date cannot be more than 90 days ahead"; an invalid
      date → "Enter a valid rehire date".
- [ ] The same account is reactivated and a new temporary password and setup link are emailed.
- [ ] Main project: the chosen ACTIVE project, else the last main project if ACTIVE, else mainProjectId
      "Select an active main project."
- [ ] Approval group, shift, salary (new row from the rehire date) and leave policies are kept when still active;
      leave balances start fresh per 13b.
- [ ] Employment type is kept; role, department, designation and staffing company are kept when still active, else
      cleared (designation cleared with its department); any of them can be overridden under the create rules.
- [ ] A former SUB_ADMIN stays SUB_ADMIN when the owner rehires them, and becomes EMPLOYEE when someone else does.
- [ ] Secondary projects ended at the LWD are not restored.
- [ ] Not rehire-eligible → 409 `REHIRE_NOT_ELIGIBLE` "This employee isn't eligible for rehire."; a date before
      `rehire_allowed_from` → 409 `REHIRE_NOT_ALLOWED` "This employee isn't eligible for rehire until {date}."
- [ ] The email has a current account in another company → 409 `ACCOUNT_EMAIL_IN_OTHER_COMPANY`
      "This email is already used by another company."
- [ ] Rehiring when the exit isn't EXITED → 409 `EXIT_INVALID_STATE`
      "This action isn't possible in the exit's current status."
- [ ] `FORBIDDEN` without `employee:create`; another company's employee → `NOT_FOUND`.
