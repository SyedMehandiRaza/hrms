# 26: Approval groups list, create/edit, group view

**What to build:** `/admin/approvals` (Groups tab) and `/admin/approvals/approval-group/:id` use real groups; the
Settings tab is left as is (D17–D22).

**Blocked by:** 10 Approval groups API

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] The groups list shows ID, name + code, module ("All requests") and levels; sorting works.
- [ ] Create "HR Exit" with two approvers on L1 and one on L2 → toast; the view shows the levels and Mandatory/Can skip.
- [ ] The Module dropdown offers only "All requests".
- [ ] Duplicate name or code → "An approval group with this name already exists." / "An approval group with this code
      already exists."
- [ ] Levels 1 and 3 → "Levels must start at 1 with no gaps."
- [ ] Edit details and edit members → saved.
- [ ] Deactivate a group in use → "This approval group is in use and can't be removed."; an unused one shows Inactive
      and can be activated again.
- [ ] Removing a level while a request is pending on it → "This group has pending requests. Decide them before
      removing levels."
- [ ] Other field errors (name, code, no approvers, duplicate approver, project scope) show the `docs/standards.md` §7.2
      "Approval group" texts.
- [ ] A group with an empty level shows "Level n has no active approver."
- [ ] Without approval-group permissions the buttons are hidden.
- [ ] Lint passes.
