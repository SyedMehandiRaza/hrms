# 12: Employee drafts API

**What to build:** A half-filled Add Employee wizard can be saved and resumed later by anyone allowed to create
employees (D53).

**Blocked by:** 01 Schema changes

**Status:** ready-for-agent

- [ ] When a user with `employee:create` saves a draft on step 2 with only a name → 201; no field validation runs.
- [ ] Saving again updates the same draft (step, data, last saved, saved by).
- [ ] The list shows name (or "Untitled"), progress "step x of 5", last saved and saved by, newest first.
- [ ] Another user with `employee:create` in the same company can open and resume it.
- [ ] Data over 1 MB → 400 `VALIDATION_FAILED`, data "Draft is too large (max 1 MB)."
- [ ] Deleting a draft removes it from the list.
- [ ] `FORBIDDEN` without `employee:create`; another company's draft → `NOT_FOUND`.
