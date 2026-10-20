# 14a: Employee list, detail, bulk (de)activate, resend login API

**What to build:** Admins find employees, view their details, switch logins off and on in bulk and resend the welcome
email; employees see only their own profile (D47, D56, D56a, D57).

**Blocked by:** 13b At-create setup

**Status:** ready-for-agent

- [ ] The list filters by project (main or secondary), type, role, status (Active / In notice / Exited) and search
      (name, Employee ID, ID number, email), with pagination.
- [ ] Detail returns overview, projects (current, past, history), shift, leave policies, salary and approval group
      (or none).
- [ ] Bulk deactivate → accounts SUSPENDED and their sessions revoked; bulk activate → ACTIVE.
- [ ] A batch containing an exited employee → 409 `EMPLOYEE_EXITED` "This employee has exited. Use Rehire." and no
      account in the batch changes.
- [ ] Resend login → a new temporary password and setup link email; the old link no longer works.
- [ ] Resend login for an exited employee → 409 `EMPLOYEE_EXITED`.
- [ ] An EMPLOYEE-panel login reading another employee → `FORBIDDEN`; their own profile works.
- [ ] `FORBIDDEN` without `employee:read` / `employee:update`, or for a STAFFING_COMPANY login; another company's
      employee → `NOT_FOUND`.
