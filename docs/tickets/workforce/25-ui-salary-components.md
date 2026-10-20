# 25: Salary components screen

**What to build:** `/admin/salary-component` uses real components, with default/system ones locked (D41–D43).

**Blocked by:** 09 Salary components API

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] The list shows the 9 starter components; Basic, Housing, Transport and Hourly have the "Default" badge and a lock
      instead of Edit/Delete.
- [ ] Search, type and status filters and pagination work.
- [ ] Create "Site Allowance" → toast and listed; duplicate → "A salary component with this name already exists."
- [ ] Edit a non-system component → saved; changing the type of one in use → "The type can't change once employees use
      this component."
- [ ] Delete → it shows Inactive and isn't offered in the wizard.
- [ ] Buttons follow `salary` permissions (not `payroll`).
- [ ] Lint passes.
