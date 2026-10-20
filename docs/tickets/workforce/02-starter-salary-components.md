# 02: Starter salary components

**What to build:** Every company has the starter salary components (D42), so the employee wizard always has Basic,
Housing and Transport to fill first.

**Blocked by:** 01 Schema changes

**Status:** ready-for-agent

- [ ] When someone signs up → the new company has the 9 starter components with the codes, types and kinds from D42.
- [ ] BASIC, HOUSING and TRANSPORT are `is_default` + `is_system`; HOURLY is `is_system` only; the other five are neither.
- [ ] A data migration gives every existing company the starter set, skipping codes it already has (re-running it adds nothing).
- [ ] Sign-up still creates everything in one transaction: a failure leaves no company and no components.
- [ ] A second company's components are separate from the first's.
