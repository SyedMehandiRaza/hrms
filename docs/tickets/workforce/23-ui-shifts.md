# 23: Shift list + add/edit (timing history, week-offs, copy)

**What to build:** `/admin/shift-management`, `/admin/add-shift` and `/admin/edit/:id` use real data, including
the weekly-off picker and "Copy week-offs to next year" (D35–D39).

**Blocked by:** 06 Shifts API + timing history, 07 Week-offs + copy API

**Status:** done

Verified by the ui-tester agent:

- [x] The list shows name, start and end (searchable, paginated).
- [x] Create "Night" 22:00–06:00 with Fridays off → toast; reopening shows the same times and dates.
- [x] Equal start and end → "End time must differ from start time."; duplicate name → "A shift with this name already
      exists."
- [x] Editing times shows "Effective from"; a date next week → the history shows the new row as Scheduled and the
      current one In force.
- [x] Past days and locked-year days can't be toggled; a locked removal from the API shows "Week-offs in a closed or
      past period can't be changed."
- [x] Copy week-offs → preview of the pattern → confirm → next year has those dates.
- [x] Deleting a shift in use → "This shift is assigned to employees and can't be deleted."
- [x] No shift permissions → buttons hidden; empty and error states.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.
- Added for the calendar: `GET /shifts/week-offs/years` (`shift:read`). It returns the company's financial years with
  `year_locked` and `locked_months`, plus today and the current year's id, so the calendar can navigate real years and
  save each one's off days (`PUT /shifts/:id/week-offs`). Backend tests are in `week-offs.test.js`.
- The copy modal uses the real preview and copy endpoints.
- No year is locked in the dev data. The "locked" message under the calendar was shown with a mocked 409; the API
  check against the server is real.
- Without shift permissions the buttons are disabled (the existing design), and Copy is hidden.
- Changed files lint clean.
