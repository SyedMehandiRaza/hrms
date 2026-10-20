# 14a: Employee list, detail, bulk (de)activate, resend login API

**What to build:** Admins find employees, view their details, switch logins off and on in bulk and resend the welcome
email; employees see only their own profile (D47, D56, D56a, D57).

**Blocked by:** 13b At-create setup

**Status:** done

- [x] The list filters by project (main or secondary), type, role, status (Active / In notice / Exited) and search
      (name, Employee ID, ID number, email), with pagination.
- [x] Detail returns overview, projects (current, past, history), shift, leave policies, salary and approval group
      (or none).
- [x] Bulk deactivate → accounts SUSPENDED and their sessions revoked; bulk activate → ACTIVE.
- [x] A batch containing an exited employee → 409 `EMPLOYEE_EXITED` "This employee has exited. Use Rehire." and no
      account in the batch changes.
- [x] Resend login → a new temporary password and setup link email; the old link no longer works.
- [x] Resend login for an exited employee → 409 `EMPLOYEE_EXITED`.
- [x] An EMPLOYEE-panel login reading another employee → `FORBIDDEN`; their own profile works.
- [x] `FORBIDDEN` without `employee:read` / `employee:update`, or for a STAFFING_COMPANY login; another company's
      employee → `NOT_FOUND`.

Notes (2026-10-21):
- `GET /employees?projectId=&employmentType=&roleId=&status=&search=&page=&limit=` is sorted by Employee ID. It is for
  the Admin panel only (ADMIN, or SUB_ADMIN with `employee:read`). Employee-panel logins get `FORBIDDEN` (D57).
- `GET /employees/:id` returns `{ overview, projects: { current, past, history }, shift, leave_policies, salary,
  approval_group }`, with country and city names in the caller's language. An Employee-panel login may read only its
  own record, whatever its role.
- `POST /employees/bulk-status { employeeIds, status: ACTIVE|SUSPENDED }` (`employee:update`) is all-or-nothing. The
  owner's own record gives 403 `ACCOUNT_OWNER_PROTECTED` (D56 "owner protected").
- `POST /employees/:id/resend-login` (`employee:update`) returns `{ temporary_password }`.
- Service: `backend/src/services/employeeProfile.service.js`. Tests: `backend/tests/employees-read-bulk.test.js`.
