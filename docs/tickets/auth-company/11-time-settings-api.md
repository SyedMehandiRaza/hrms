# 11: Time settings API (timezone and financial-year start month)

**What to build:** The company sets its timezone and financial-year start month; the start month locks once a
year is closing or closed (D30). The other Financial Year settings come with the Financial Year module.

**Blocked by:** 04 Login, refresh, logout (Auth)

**Status:** done

- [x] The owner, or a role with financial-year read, reads the company's time settings.
- [x] The owner sets timezone `Europe/London` → saved; `Mars/Base` → 400 `COMPANY_TIMEZONE_INVALID`
      "Choose a valid timezone".
- [x] Setting the start month to April while all years are PLANNED or OPEN → saved, and those years now run
      April to March with updated labels, all in one transaction.
- [x] Start month 13 → 400 `COMPANY_FY_START_INVALID` "Choose a month from 1 to 12".
- [x] With a CLOSING or CLOSED year (locked or not; D30, decided 2026-10-19) → 409 `COMPANY_FY_START_LOCKED`
      "The start month can't change after a financial year has been closed." and no year changes.
- [x] A sub-admin without financial-year update → 403 "You don't have permission to do this."; with it → 200.
- [x] Any other field sent along (e.g. lock mode) is ignored.
