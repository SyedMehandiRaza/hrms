# 07: Week-offs + copy to next year API

**What to build:** Admins set a shift's weekly-off dates for a financial year and copy the pattern to the next year
(D38, D39).

**Blocked by:** 06 Shifts API + timing history

**Status:** done

- [x] Saving a list of dates for the current FY → that FY's dates from today onward are replaced; past dates stay.
- [x] Removing a past date or one in a locked period → 409 `SHIFT_WEEKOFF_LOCKED`
      "Week-offs in a closed or past period can't be changed."
- [x] A date outside any existing financial year → 400 `VALIDATION_FAILED`, dates
      "Every date must fall in an existing financial year."
- [x] Copy preview to the next FY returns the weekdays that were off on at least 80% of their occurrences in the source FY.
- [x] Copy adds those dates to the chosen shifts in the next FY and never removes any (running it twice adds nothing).
- [x] Copy when the next FY doesn't exist or is locked → 409 `SHIFT_WEEKOFF_NO_NEXT_FY`
      "The next financial year doesn't exist or is locked."
- [x] `FORBIDDEN` without `shift:update`; another company's shift ids → `NOT_FOUND`.

Notes (2026-10-20): `GET/PUT /shifts/:id/week-offs` (`{ financialYearId, dates }`; GET defaults to the year
containing today and returns `today`, `year_locked`, `locked_months`). Copy: the source is the current year, the
target must be the next one (`to_fy` optional; any other year → 409); only dates from today on, in open months,
are added. Dates must be real calendar days (`validations/dates.js`, also used by projects and shifts).
