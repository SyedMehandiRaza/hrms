# 07: Week-offs + copy to next year API

**What to build:** Admins set a shift's weekly-off dates for a financial year and copy the pattern to the next year
(D38, D39).

**Blocked by:** 06 Shifts API + timing history

**Status:** ready-for-agent

- [ ] Saving a list of dates for the current FY → that FY's dates from today onward are replaced; past dates stay.
- [ ] Removing a past date or one in a locked period → 409 `SHIFT_WEEKOFF_LOCKED`
      "Week-offs in a closed or past period can't be changed."
- [ ] A date outside any existing financial year → 400 `VALIDATION_FAILED`, dates
      "Every date must fall in an existing financial year."
- [ ] Copy preview to the next FY returns the weekdays that were off on at least 80% of their occurrences in the source FY.
- [ ] Copy adds those dates to the chosen shifts in the next FY and never removes any (running it twice adds nothing).
- [ ] Copy when the next FY doesn't exist or is locked → 409 `SHIFT_WEEKOFF_NO_NEXT_FY`
      "The next financial year doesn't exist or is locked."
- [ ] `FORBIDDEN` without `shift:update`; another company's shift ids → `NOT_FOUND`.
