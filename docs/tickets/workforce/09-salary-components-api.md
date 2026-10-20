# 09: Salary components API

**What to build:** Admins manage salary components; defaults and system components are locked (D41–D43).

**Blocked by:** 02 Starter salary components

**Status:** done

- [x] When a user with `salary:create` creates "Site Allowance" (EARNING) → 201 with code `SITE_ALLOWANCE`; a code
      clash gets a suffix.
- [x] A duplicate name → 409 `SALARY_COMPONENT_NAME_TAKEN` "A salary component with this name already exists."
- [x] Name missing, outside 2–100 or with an emoji, type missing, description over 255 → 400 `VALIDATION_FAILED`
      with the `docs/standards.md` §7.2 "Salary component" texts.
- [x] Editing or deactivating BASIC, HOUSING, TRANSPORT or HOURLY → 403 `SALARY_COMPONENT_SYSTEM`
      "Default components can't be changed."
- [x] Changing the type of a component used on any salary → 409 `SALARY_COMPONENT_TYPE_LOCKED`
      "The type can't change once employees use this component."
- [x] "Delete" deactivates: the component leaves the selectable list; existing salaries keep it.
- [x] The list shows default/system flags and filters by type and status.
- [x] `FORBIDDEN` without `salary:*`; another company's component → `NOT_FOUND`.

Notes (2026-10-20): body `{ name, type, description?, status? }` (the edit modal has a status: ACTIVE re-activates).
The list puts defaults first and returns `code`, `is_default`, `is_system`, `status`, `used_on_salaries`.
