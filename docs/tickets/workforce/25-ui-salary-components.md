# 25: Salary components screen

**What to build:** `/admin/salary-component` uses real components, with default/system ones locked (D41–D43).

**Blocked by:** 09 Salary components API

**Status:** done

Verified by the ui-tester agent:

- [x] The list shows the 9 starter components; Basic, Housing, Transport and Hourly have the "Default" badge and a lock
      instead of Edit/Delete.
- [x] Search, type and status filters and pagination work.
- [x] Create "Site Allowance" → toast and listed; duplicate → "A salary component with this name already exists."
- [x] Edit a non-system component → saved; changing the type of one in use → "The type can't change once employees use
      this component."
- [x] Delete → it shows Inactive and isn't offered in the wizard.
- [x] Buttons follow `salary` permissions (not `payroll`).
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.
- The list, search, filters and paging come from `GET /salary-components`.
- The Default badge and lock follow `is_system`: Basic, Housing, Transport and Hourly.
- Duplicate names and type changes on in-use components show under their inputs.
- Delete deactivates. An inactive component drops out of `GET /salary-components?status=ACTIVE`, which the wizard uses.
- Buttons follow `salary` permissions (checked with mocked roles), not `payroll`.
