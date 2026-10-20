# 23: Shift list + add/edit (timing history, week-offs, copy)

**What to build:** `/admin/shift-management`, `/admin/add-shift` and `/admin/edit/:id` use real data, including
the weekly-off picker and "Copy week-offs to next year" (D35–D39).

**Blocked by:** 06 Shifts API + timing history, 07 Week-offs + copy API

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] The list shows name, start and end (searchable, paginated).
- [ ] Create "Night" 22:00–06:00 with Fridays off → toast; reopening shows the same times and dates.
- [ ] Equal start and end → "End time must differ from start time."; duplicate name → "A shift with this name already
      exists."
- [ ] Editing times shows "Effective from"; a date next week → the history shows the new row as Scheduled and the
      current one In force.
- [ ] Past days and locked-year days can't be toggled; a locked removal from the API shows "Week-offs in a closed or
      past period can't be changed."
- [ ] Copy week-offs → preview of the pattern → confirm → next year has those dates.
- [ ] Deleting a shift in use → "This shift is assigned to employees and can't be deleted."
- [ ] No shift permissions → buttons hidden; empty and error states.
- [ ] Lint passes.
