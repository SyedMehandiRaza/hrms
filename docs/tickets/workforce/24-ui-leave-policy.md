# 24: Leave policy screen

**What to build:** `/admin/leave-management/leave-policy` and its create/edit modal use real leave types (D30–D32).

**Blocked by:** 08 Leave types / policies API

**Status:** done

Verified by the ui-tester agent:

- [x] The table shows name, paid/unpaid, total days, carry forward, encashment and status; status filter and
      pagination work; stat cards stay as they are.
- [x] Create "Annual Leave" / ANNUAL, 21 days, upfront → toast and listed.
- [x] Duplicate name or code → "A leave type with this name already exists." / "A leave type with this code already
      exists."
- [x] The modal's field errors match the server's for every field.
- [x] Edit → saved in place; "Save as new version" → "Policy versions aren't available yet."
- [x] Set inactive → shows Inactive; it's no longer offered in the employee wizard.
- [x] Delete an assigned type → "This leave type is assigned to employees and can't be deleted."
- [x] Without `leave_type` permissions the buttons are hidden.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.
- The table, status filter and pagination come from `GET /leave-types`. The stat cards are static as before.
- The modal maps every server field error to its input. Duplicate name and code show under their inputs.
- "Save as new version" shows the server's "Policy versions aren't available yet.".
- An inactive type drops out of `GET /leave-types?status=ACTIVE`, which the employee wizard uses (28a).
- Permissions were checked with mocked roles.
- Changed files lint clean.
