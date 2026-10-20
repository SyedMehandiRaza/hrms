# 10: Approval groups API

**What to build:** Admins build approval groups with ordered levels of approvers; groups aren't tied to a module
(D17–D22, ADR 11).

**Blocked by:** 01 Schema changes

**Status:** done

Field texts: `docs/standards.md` §7.2 "Approval group". Tests create employees as fixtures.

- [x] When a user with `approval_group:create` creates "HR Exit" / code `hr-exit` with approvers on levels 1 and 2 →
      201, code stored `HR-EXIT`, 2 levels.
- [x] A duplicate name (also of an inactive group) → 409 `APPROVAL_GROUP_NAME_TAKEN` "An approval group with this name
      already exists."; a duplicate code → 409 `APPROVAL_GROUP_CODE_TAKEN` "An approval group with this code already exists."
- [x] Name, code or description outside their lengths → 400 `VALIDATION_FAILED` with the §7.2 texts.
- [x] Levels 1 and 3 → members "Levels must start at 1 with no gaps."
- [x] No members → members "Add at least one approver"; the same employee twice → "Employee cannot be selected
      multiple times. Each employee can only appear once in the approval hierarchy."; an EXITED or other-company
      employee → "Select an active employee of this company."
- [x] A PROJECT-scoped group without a project → projectId "Please select a project"; with no approver on that
      project → "At least one approver must be an employee of the selected project."
- [x] Any module other than "ALL" → 400 `APPROVAL_ROUTING_PER_MODULE_DISABLED` "Per-module routing isn't available yet."
- [x] Deactivating a group routed to a non-exited employee or with pending requests → 409 `APPROVAL_GROUP_IN_USE`
      "This approval group is in use and can't be removed."; otherwise it becomes inactive.
- [x] An inactive group can be activated again and is then routable.
- [x] A group with a level that has no active approver is flagged "Level n has no active approver."
- [x] `FORBIDDEN` without `approval_group:*`; another company's group → `NOT_FOUND`.

Notes (2026-10-20): body `{ name, code, description?, scope, projectId?, moduleKey?, members: [{ employeeId,
level, isMandatory?, canSkip? }] }`; `PUT /:id` edits the details, `PUT /:id/members` the members, `PATCH /:id/status`
`{ status }`. Removed approvers are deactivated, not deleted (request logs point at them). The flag is
`levels_without_active_approver: [n]` (the UI words it). Also `GET /approval-groups/approver-options?projectId=`.
Member errors use the §7.2 text "Select an active employee of this company." (catalog key `departmentHeadInvalid`).
