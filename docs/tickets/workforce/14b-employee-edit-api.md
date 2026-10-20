# 14b: Employee edit API

**What to build:** Admins edit an employee's job fields, access level, shift, leave policies and approval group
(D40, D48, D51, D54, D33 leave add/remove, D56a).

**Blocked by:** 14a Employee list, detail, bulk (de)activate, resend login API

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Employee (create, edit)".

- [ ] Editing job fields follows the create rules and texts (13a/13b); salary fields in the edit are ignored.
- [ ] Phone, nationality and residence country/city follow the same rules as create (13a).
- [ ] Changing the shift → effective today with a history row; a second change the same day overwrites that row;
      clearing writes no row.
- [ ] Removing a leave policy sets its end date to today and keeps the balance; adding one creates a balance per 13b.
- [ ] Setting a group on an employee who has none creates the routing row; changing it doesn't move pending requests
      (they keep their frozen group).
- [ ] A non-owner changing someone to SUB_ADMIN → `FORBIDDEN`; the owner's account can't be changed → 403
      `ACCOUNT_OWNER_PROTECTED` "The company owner's account can't be changed."
- [ ] Changing the access level to GENERAL_EMPLOYEE while they have more than one current project → 409
      `PROJECT_GENERAL_EMPLOYEE_SINGLE` "General employees can belong to only one project."
- [ ] Editing an exited employee → 409 `EMPLOYEE_EXITED` "This employee has exited. Use Rehire."; an IN_NOTICE employee
      can be edited.
- [ ] `FORBIDDEN` without `employee:update`; another company's employee or ids → `NOT_FOUND`.
