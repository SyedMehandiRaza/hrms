# 01: Schema changes

**What to build:** The database supports the workforce plan (plan §3): 1:1 head office ↔ project, the new project and
exit statuses, main-project periods, generated codes, default salary components, the `exit` permission module, the
owner as an approval actor, and seeds/existing data that fit the new rules.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `projects.office_id` is required and unique: a second project for the same head office fails at the database.
- [x] Project status accepts only ACTIVE, ON_HOLD, COMPLETED; existing INACTIVE rows become ON_HOLD.
- [x] `offices.status` is gone; office and project names can be reused after a soft delete (`live_key`).
- [x] Approval-group names are unique per company `(employer_id, group_name)` with no `live_key` (groups are never
      deleted); existing groups get `module_key = 'ALL'`.
- [x] Number sequences accept PROJECT and EMPLOYEE; `financial_year_id` is nullable and EMPLOYEE uses one row per
      company with no FY; a second EMPLOYEE row for the same company fails at the database. An existing company's
      EMPLOYEE sequence starts at its highest existing `EMP-` number.
- [x] Project history rows carry an effective date; the main-project periods table records (employee, project, from, to).
- [x] Shift history rows carry `employer_id`; salary components carry `is_default`.
- [x] Approval requests carry `requested_by_user_id` (required, backfilled) and `requested_by` (employee) is optional;
      request logs carry `actor_user_id` and `is_override`, and `approval_group_member_id` / `employee_id` are optional.
- [x] Exit status accepts PENDING_APPROVAL and REJECTED and defaults to PENDING_APPROVAL; exits link to an approval
      request and hold a reject reason; exit event types add APPROVED, REJECTED, WITHDRAWN.
- [x] `employees.office_id` stays in the table but is marked deprecated in the model (not read or written).
- [x] The `exit` module exists in `modules`; seeded roles get it as in the plan's permission matrix.
- [x] Data: a head office with more than one project gets a copy named "<name> (2)", "(3)"… per extra project, so
      every project has its own office; existing project codes are kept.
- [x] Seeders updated: a second head office "Jeddah Head Office" holds the second project; project codes
      `PRJ-FY26-0001` / `0002`; one `ALL` approval group replaces the per-module ones, with a routing row for every
      seeded employee; `docs/test-users.md` matches.
- [x] Migrations run up and down cleanly on an empty database and on the seeded dev database; `npm run db:seed` on a
      fresh database succeeds.

Notes (2026-10-20): migrations `20261020600001`–`600005`. The number-sequence key uses a VIRTUAL generated
`fy_key` (MySQL refuses a STORED one on a CASCADE foreign key). `projects.office_id` is ON DELETE RESTRICT. Dev DB
run on the old seed: the second project moved to a copy of its shared office, "Riyadh Head Office (2)"; EMPLOYEE
sequence started at 8. A fresh seed also has a PROJECT sequence for FY 2026 at 2 (codes 0001/0002 are taken).
Sub Admin gets `exit` create/read/update (the role is built from every module); other seeded roles don't.
