# 14b: Employee edit API

**What to build:** Admins edit an employee's job fields, access level, shift, leave policies and approval group
(D40, D48, D51, D54, D33 leave add/remove, D56a).

**Blocked by:** 14a Employee list, detail, bulk (de)activate, resend login API

**Status:** done

Field texts: `docs/standards.md` §7.2 "Employee (create, edit)".

- [x] Editing job fields follows the create rules and texts (13a/13b); salary fields in the edit are ignored.
- [x] Phone, nationality and residence country/city follow the same rules as create (13a).
- [x] Changing the shift → effective today with a history row; a second change the same day overwrites that row;
      clearing writes no row.
- [x] Removing a leave policy sets its end date to today and keeps the balance; adding one creates a balance per 13b.
- [x] Setting a group on an employee who has none creates the routing row; changing it doesn't move pending requests
      (they keep their frozen group).
- [x] A non-owner changing someone to SUB_ADMIN → `FORBIDDEN`; the owner's account can't be changed → 403
      `ACCOUNT_OWNER_PROTECTED` "The company owner's account can't be changed."
- [x] Changing the access level to GENERAL_EMPLOYEE while they have more than one current project → 409
      `PROJECT_GENERAL_EMPLOYEE_SINGLE` "General employees can belong to only one project."
- [x] Editing an exited employee → 409 `EMPLOYEE_EXITED` "This employee has exited. Use Rehire."; an IN_NOTICE employee
      can be edited.
- [x] `FORBIDDEN` without `employee:update`; another company's employee or ids → `NOT_FOUND`.

Notes (2026-10-21):
- `PUT /employees/:id` (`employee:update`) takes the create body. Salary fields, `projectIds`, `mainProjectId`,
  `joiningDate` and `draft_id` are ignored (salary isn't editable, D52; projects go through 05 and 15).
- The response is the employee detail (14a).
- Email can be edited, as in the UI's Edit modal, under the same uniqueness rules. Another person's email gives
  `EMPLOYEE_EMAIL_TAKEN` when they are in this company, otherwise `ACCOUNT_EMAIL_IN_OTHER_COMPANY`.
- A kept leave policy that has since become inactive stays assigned. A newly added policy starts today, with its
  balance prorated from today.
- With no active group in the company, an empty `approvalGroupId` removes the routing row.
- The owner's own employee record → `ACCOUNT_OWNER_PROTECTED`.
- Tests: `backend/tests/employees-edit.test.js`.
