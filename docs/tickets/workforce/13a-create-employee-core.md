# 13a: Create employee core

**What to build:** An admin creates an employee with their main project and approval group, and the new employee
receives their login (D18, D45–D51, D53, ADR 2, ADR 3).

**Blocked by:** 04 Projects API, 10 Approval groups API, 12 Employee drafts API, 12b Roles and staffing-company lookups
API; geo 02 Phone service, geo 03 Countries and cities API

**Status:** done

Field texts: `docs/standards.md` §7.2 "Employee (create, edit)".

- [x] When a user with `employee:create` creates an employee → 201 with Employee ID `EMP-0001` (next `EMP-0002`);
      user, account, employee, project assignments with ASSIGNED rows, the main period and the routing row
      (`module_key = 'ALL'`) exist.
- [x] In a company with no active approval group, the employee is created without a group (no routing row).
- [x] A welcome email with temporary password and setup link is sent after commit; if the person already has a
      password (ended account elsewhere) the email has no temporary password.
- [x] If the email fails, the employee still exists.
- [x] Duplicate ID number → 409 `EMPLOYEE_ID_NUMBER_TAKEN` "An employee with this ID number already exists."
- [x] Email used in this company → 409 `EMPLOYEE_EMAIL_TAKEN` "An employee with this email already exists."; a current
      account in another company → 409 `ACCOUNT_EMAIL_IN_OTHER_COMPANY` "This email is already used by another company."
- [x] Duplicate phone → 409 `EMPLOYEE_PHONE_TAKEN` "An employee with this phone number already exists."; `0501234567`
      and `+966501234567` (SA) count as the same number.
- [x] Phone stored as E.164 with its phone country (default company country, not nationality); nationality saved as a
      country id; residence country (required, default company country) and optional residence city in that country
      (`docs/plans/countries-cities-phones.md` D12–D19).
- [x] The uniqueness check endpoint answers the same three rules for the wizard's step 1.
- [x] Name, ID number, email, phone and employment type rules → 400 `VALIDATION_FAILED` with the §7.2 texts.
- [x] Access level ADMIN → 409 `ACCOUNT_ADMIN_EXISTS` "This company already has an owner. Add other admins as Sub
      Admin."; STAFFING_COMPANY → accessLevel "Choose Employee, General employee or Sub admin."
- [x] A non-owner creating a SUB_ADMIN → 403 `FORBIDDEN`; the owner can.
- [x] EMPLOYEE and GENERAL_EMPLOYEE may have no role (the account then has every flag false); a SUB_ADMIN without a
      role → roleId "Role is required"; another company's role → `NOT_FOUND`.
- [x] A non-ACTIVE project → projectIds "Select active projects only."; no project → "Select at least one project";
      main project missing or not among the projects → mainProjectId "Select a main project" / "Main project must be
      one of the selected projects"; a GENERAL_EMPLOYEE with two projects → projectIds "A General Employee can be
      assigned to only one project".
- [x] Joining date before the main project's start → joiningDate "Joining date can't be before the main project's start
      date."; more than 12 months ahead → "Joining date can't be more than 12 months ahead."; empty → today.
- [x] Once the company has an active group: no group, an unknown group or an inactive group → approvalGroupId
      "Select an approval group."; a PROJECT group for another project → 409 `APPROVAL_GROUP_PROJECT_MISMATCH` "This
      approval group belongs to a different project."
- [x] Per-module routing → 400 `APPROVAL_ROUTING_PER_MODULE_DISABLED` "Per-module routing isn't available yet."
- [x] Inactive department → departmentId "Select an active department."; inactive designation or one from another
      department → designationId "Select an active designation of this department."; a staffing company on a
      Full-time employee → staffingCompanyId "A staffing company applies only to contract employees."; an inactive one
      → "Select an active staffing company."
- [x] Creating with a `draft_id` deletes that draft.
- [x] Any failure leaves nothing behind (single transaction); another company's ids → `NOT_FOUND`; a STAFFING_COMPANY
      login → `FORBIDDEN`.

Notes (2026-10-21): `POST /employees` (`employee:create`). Body keys match standards §7.2: `name`, `country_emp_id`,
`email`, `phone`, `phoneCountry`, `nationalityCountryId`, `residenceCountryId?`, `residenceCityId?`, `dob?`, `gender?`,
`address?`, `accommodation?`, `employmentType`, `accessLevel`, `roleId?`, `projectIds`, `mainProjectId`, `joiningDate?`,
`departmentId?`, `designationId?`, `staffingCompanyId?`, `approvalGroupId?`, `moduleKey?` (only `ALL`), `draft_id?`.
`GET /employees/check-unique?country_emp_id=&email=&phone=&phoneCountry=` (`employee:create` or `update`) returns
`{ field: { available } | { available: false, code, message } }` for each field given. Phone numbers are unique per
company only (user decision 2026-10-21, plan D46): migration `20261021600009` drops the global unique index on
`users.phone_number`. Creates in one company are serialised on its EMPLOYEE sequence row. A designation needs its
department. Service: `backend/src/services/employee.service.js`. Tests: `backend/tests/employees-create.test.js`.
