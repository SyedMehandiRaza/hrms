# 10: Approval groups API

**What to build:** Admins build approval groups with ordered levels of approvers; groups aren't tied to a module
(D17–D22, ADR 11).

**Blocked by:** 01 Schema changes

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Approval group". Tests create employees as fixtures.

- [ ] When a user with `approval_group:create` creates "HR Exit" / code `hr-exit` with approvers on levels 1 and 2 →
      201, code stored `HR-EXIT`, 2 levels.
- [ ] A duplicate name (also of an inactive group) → 409 `APPROVAL_GROUP_NAME_TAKEN` "An approval group with this name
      already exists."; a duplicate code → 409 `APPROVAL_GROUP_CODE_TAKEN` "An approval group with this code already exists."
- [ ] Name, code or description outside their lengths → 400 `VALIDATION_FAILED` with the §7.2 texts.
- [ ] Levels 1 and 3 → members "Levels must start at 1 with no gaps."
- [ ] No members → members "Add at least one approver"; the same employee twice → "Employee cannot be selected
      multiple times. Each employee can only appear once in the approval hierarchy."; an EXITED or other-company
      employee → "Select an active employee of this company."
- [ ] A PROJECT-scoped group without a project → projectId "Please select a project"; with no approver on that
      project → "At least one approver must be an employee of the selected project."
- [ ] Any module other than "ALL" → 400 `APPROVAL_ROUTING_PER_MODULE_DISABLED` "Per-module routing isn't available yet."
- [ ] Deactivating a group routed to a non-exited employee or with pending requests → 409 `APPROVAL_GROUP_IN_USE`
      "This approval group is in use and can't be removed."; otherwise it becomes inactive.
- [ ] An inactive group can be activated again and is then routable.
- [ ] A group with a level that has no active approver is flagged "Level n has no active approver."
- [ ] `FORBIDDEN` without `approval_group:*`; another company's group → `NOT_FOUND`.
