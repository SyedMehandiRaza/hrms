# 09: Salary components API

**What to build:** Admins manage salary components; defaults and system components are locked (D41–D43).

**Blocked by:** 02 Starter salary components

**Status:** ready-for-agent

- [ ] When a user with `salary:create` creates "Site Allowance" (EARNING) → 201 with code `SITE_ALLOWANCE`; a code
      clash gets a suffix.
- [ ] A duplicate name → 409 `SALARY_COMPONENT_NAME_TAKEN` "A salary component with this name already exists."
- [ ] Name missing, outside 2–100 or with an emoji, type missing, description over 255 → 400 `VALIDATION_FAILED`
      with the `docs/standards.md` §7.2 "Salary component" texts.
- [ ] Editing or deactivating BASIC, HOUSING, TRANSPORT or HOURLY → 403 `SALARY_COMPONENT_SYSTEM`
      "Default components can't be changed."
- [ ] Changing the type of a component used on any salary → 409 `SALARY_COMPONENT_TYPE_LOCKED`
      "The type can't change once employees use this component."
- [ ] "Delete" deactivates: the component leaves the selectable list; existing salaries keep it.
- [ ] The list shows default/system flags and filters by type and status.
- [ ] `FORBIDDEN` without `salary:*`; another company's component → `NOT_FOUND`.
