# 06: Shifts API + timing history

**What to build:** Admins manage shifts, including overnight shifts and time changes that start on a chosen date
(D35–D37).

**Blocked by:** 01 Schema changes

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Shift".

- [ ] When a user with `shift:create` creates "Day" 08:00–17:00 → 201 with one timing row effective from today.
- [ ] "Night" 22:00–06:00 is accepted as an overnight shift.
- [ ] Missing name, name over 50, missing start or end → 400 `VALIDATION_FAILED` with the §7.2 texts.
- [ ] Equal start and end → end_time "End time must differ from start time."
- [ ] A duplicate name (any case) → 409 `SHIFT_NAME_TAKEN` "A shift with this name already exists."
- [ ] Times changed with an effective-from next week → a new timing row; today's times are unchanged and the new row
      is "Scheduled".
- [ ] An effective-from before the FY start or inside a closed/locked period → effective_from "Choose a date from the
      start of the financial year that isn't in a closed or locked period."
- [ ] A name-only edit adds no timing row.
- [ ] Deleting a shift used by a non-exited employee → 409 `SHIFT_IN_USE`
      "This shift is assigned to employees and can't be deleted."; an unused shift is soft-deleted.
- [ ] `FORBIDDEN` without `shift:*`; another company's shift → `NOT_FOUND`.
