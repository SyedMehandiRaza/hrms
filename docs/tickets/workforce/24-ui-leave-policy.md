# 24: Leave policy screen

**What to build:** `/admin/leave-management/leave-policy` and its create/edit modal use real leave types (D30–D32).

**Blocked by:** 08 Leave types / policies API

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] The table shows name, paid/unpaid, total days, carry forward, encashment and status; status filter and
      pagination work; stat cards stay as they are.
- [ ] Create "Annual Leave" / ANNUAL, 21 days, upfront → toast and listed.
- [ ] Duplicate name or code → "A leave type with this name already exists." / "A leave type with this code already
      exists."
- [ ] The modal's field errors match the server's for every field.
- [ ] Edit → saved in place; "Save as new version" → "Policy versions aren't available yet."
- [ ] Set inactive → shows Inactive; it's no longer offered in the employee wizard.
- [ ] Delete an assigned type → "This leave type is assigned to employees and can't be deleted."
- [ ] Without `leave_type` permissions the buttons are hidden.
- [ ] Lint passes.
