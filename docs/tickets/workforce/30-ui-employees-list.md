# 30: Employees list

**What to build:** `/admin/employees` lists real employees with filters and bulk activate/deactivate (D56).

**Blocked by:** 14a Employee list, detail, bulk (de)activate, resend login API

**Status:** done

Verified by the ui-tester agent:

- [x] Columns: S.N, Employee ID, Iqama No., name + status + email, role, type, project, staffing company.
- [x] Filters for project, type, role and status (Active / In notice / Exited) and search by name, Employee ID,
      ID number or email; pagination.
- [x] Bulk deactivate two employees → toast; one of them can't log in.
- [x] Bulk activate them → they can log in again.
- [x] A selection that includes an exited employee → "This employee has exited. Use Rehire." and nobody in the
      selection changes.
- [x] Rows open the detail page; empty and error states; buttons follow `employee` permissions.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.
- Columns, filters (type, role, project, status), search and paging come from `GET /employees`.
- Bulk deactivate blocks login (`AUTH_ACCOUNT_INACTIVE`); activate restores it.
- The exited-employee batch error was checked with a mocked 409 `EMPLOYEE_EXITED`. Its toast shows and nothing reloads. The dev DB had no exited employee.
- ACTIVE rows show no status badge. The shared `EmploymentStatusBadge` only marks In notice and Exited.
- Permissions were checked with mocked roles: checkboxes and the bulk bar need `employee:update`; Add and Drafts need `employee:create`.
- `api/employees.js` and the employees locales are committed here with the wizard functions they also hold (28a).
