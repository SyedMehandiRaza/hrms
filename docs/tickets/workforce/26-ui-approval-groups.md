# 26: Approval groups list, create/edit, group view

**What to build:** `/admin/approvals` (Groups tab) and `/admin/approvals/approval-group/:id` use real groups; the
Settings tab is left as is (D17–D22).

**Blocked by:** 10 Approval groups API

**Status:** done

Verified by the ui-tester agent:

- [x] The groups list shows ID, name + code, module ("All requests") and levels; sorting works.
- [x] Create "HR Exit" with two approvers on L1 and one on L2 → toast; the view shows the levels and Mandatory/Can skip.
- [x] The Module dropdown offers only "All requests".
- [x] Duplicate name or code → "An approval group with this name already exists." / "An approval group with this code
      already exists."
- [x] Levels 1 and 3 → "Levels must start at 1 with no gaps."
- [x] Edit details and edit members → saved.
- [x] Deactivate a group in use → "This approval group is in use and can't be removed."; an unused one shows Inactive
      and can be activated again.
- [x] Removing a level while a request is pending on it → "This group has pending requests. Decide them before
      removing levels."
- [x] Other field errors (name, code, no approvers, duplicate approver, project scope) show the `docs/standards.md` §7.2
      "Approval group" texts.
- [x] A group with an empty level shows "Level n has no active approver."
- [x] Without approval-group permissions the buttons are hidden.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.
- The list, sorting, create, edit details, edit members, deactivate and activate all run on `/approval-groups`.
- Server 409s show under their inputs, or above the members for `APPROVAL_GROUP_HAS_PENDING`.
- Client rule texts follow standards §7.2 "Approval group", inline in the create, edit and members modals. This includes the new string "Select an active employee of this company.".
- The name and code inputs stop at 100 and 50 characters, so "Must be … or less" only comes from the server.
- An inactive group shows an "Activate" button on its view; this is a UI addition so that "can be activated again" is reachable.
- Permissions were checked with mocked roles, since ADMIN bypasses them.
