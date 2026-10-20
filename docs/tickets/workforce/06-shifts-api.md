# 06: Shifts API + timing history

**What to build:** Admins manage shifts, including overnight shifts and time changes that start on a chosen date
(D35–D37).

**Blocked by:** 01 Schema changes

**Status:** done

Field texts: `docs/standards.md` §7.2 "Shift".

- [x] When a user with `shift:create` creates "Day" 08:00–17:00 → 201 with one timing row effective from today.
- [x] "Night" 22:00–06:00 is accepted as an overnight shift.
- [x] Missing name, name over 50, missing start or end → 400 `VALIDATION_FAILED` with the §7.2 texts.
- [x] Equal start and end → end_time "End time must differ from start time."
- [x] A duplicate name (any case) → 409 `SHIFT_NAME_TAKEN` "A shift with this name already exists."
- [x] Times changed with an effective-from next week → a new timing row; today's times are unchanged and the new row
      is "Scheduled".
- [x] An effective-from before the FY start or inside a closed/locked period → effective_from "Choose a date from the
      start of the financial year that isn't in a closed or locked period."
- [x] A name-only edit adds no timing row.
- [x] Deleting a shift used by a non-exited employee → 409 `SHIFT_IN_USE`
      "This shift is assigned to employees and can't be deleted."; an unused shift is soft-deleted.
- [x] `FORBIDDEN` without `shift:*`; another company's shift → `NOT_FOUND`.

Notes (2026-10-20): body keys follow standards §7.2 (`name, start_time, end_time, effective_from`). Responses carry
the times in force today, `is_overnight`, `scheduled` rows, and on detail the `history` (newest first, `state` IN_FORCE |
SCHEDULED | PAST). "Closed or locked" = the FY is CLOSED or locked, or the month has an ALL/ATTENDANCE period lock
(`services/periodLock.service.js`). Migration `20261020600007` gives shift names a `live_key` (standards §5), so a
deleted shift's name can be reused.
