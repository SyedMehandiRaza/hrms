# 02: Starter salary components

**What to build:** Every company has the starter salary components (D42), so the employee wizard always has Basic,
Housing and Transport to fill first.

**Blocked by:** 01 Schema changes

**Status:** done

- [x] When someone signs up → the new company has the 9 starter components with the codes, types and kinds from D42.
- [x] BASIC, HOUSING and TRANSPORT are `is_default` + `is_system`; HOURLY is `is_system` only; the other five are neither.
- [x] A data migration gives every existing company the starter set, skipping codes it already has (re-running it adds nothing).
- [x] Sign-up still creates everything in one transaction: a failure leaves no company and no components.
- [x] A second company's components are separate from the first's.

Notes (2026-10-20): one list in `backend/src/utils/starterSalaryComponents.js`, used by sign-up, migration
`20261020600006` and the seeder. A code or a name the company already uses is skipped. Dev DB run: 3 added.
