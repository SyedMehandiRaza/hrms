# 12b: Roles and staffing-company lookups API

**What to build:** The employee wizard and edit modal can list the company's roles and active staffing companies
(D48). Read-only; the full Roles and Staffing companies modules are planned separately.

**Blocked by:** 01 Schema changes

**Status:** ready-for-agent

- [ ] A user with `employee:create` or `employee:update` gets `GET /roles` → the company's roles (id, name), sorted by name.
- [ ] `GET /staffing-companies?status=ACTIVE` → the company's active staffing companies (id, name, code).
- [ ] A new company with no roles gets an empty list, not an error.
- [ ] Without either permission, or as a STAFFING_COMPANY login → 403 `FORBIDDEN` "You don't have permission to do this."
- [ ] A second company's roles and staffing companies never appear.
