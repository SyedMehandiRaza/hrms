# 30: Employees list

**What to build:** `/admin/employees` lists real employees with filters and bulk activate/deactivate (D56).

**Blocked by:** 14a Employee list, detail, bulk (de)activate, resend login API

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] Columns: S.N, Employee ID, Iqama No., name + status + email, role, type, project, staffing company.
- [ ] Filters for project, type, role and status (Active / In notice / Exited) and search by name, Employee ID,
      ID number or email; pagination.
- [ ] Bulk deactivate two employees → toast; one of them can't log in.
- [ ] Bulk activate them → they can log in again.
- [ ] A selection that includes an exited employee → "This employee has exited. Use Rehire." and nobody in the
      selection changes.
- [ ] Rows open the detail page; empty and error states; buttons follow `employee` permissions.
- [ ] Lint passes.
