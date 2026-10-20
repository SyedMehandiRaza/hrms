# 12b: Roles and staffing-company lookups API

**What to build:** The employee wizard and edit modal can list the company's roles and active staffing companies
(D48). Read-only; the full Roles and Staffing companies modules are planned separately.

**Blocked by:** 01 Schema changes

**Status:** done

- [x] A user with `employee:create` or `employee:update` gets `GET /roles` → the company's roles (id, name), sorted by name.
- [x] `GET /staffing-companies?status=ACTIVE` → the company's active staffing companies (id, name, code).
- [x] A new company with no roles gets an empty list, not an error.
- [x] Without either permission, or as a STAFFING_COMPANY login → 403 `FORBIDDEN` "You don't have permission to do this."
- [x] A second company's roles and staffing companies never appear.

Notes (2026-10-21): `GET /roles` → `[{ id, name }]`. `GET /staffing-companies?status=ACTIVE|INACTIVE` (absent = all) →
`[{ id, name, code }]`. Both are sorted by name and return a plain array, not a page. `requirePermission(module, [actions])` now
passes when the role has any of the listed actions. Files: `backend/src/{routes,services,controllers,validations}/lookup.*`.
Tests: `backend/tests/lookups.test.js`.
