# 25: Financial Year tab: timezone and start month

**What to build:** On Settings → Financial Year, the settings card loads the real time settings and saves
timezone and start month. The tab's other fields and panels are left as they are for the Financial Year module
(D30).

**Blocked by:** 14 UI foundation, 11 Time settings API

**Status:** done

Verified by the ui-tester agent:

- [x] The card shows the loading state, then the company's timezone and start month.
- [x] Owner changes timezone and start month → Save → success; reloading shows both. (The years list stays
      static until the Financial Year module.)
- [x] With a closing or closed year, the start month is disabled with "The start month can't change after a
      financial year has been closed."
- [x] Invalid values show "Choose a valid timezone" / "Choose a month from 1 to 12" under the field.
- [x] A sub-admin without financial-year update sees the card read-only.
- [x] Server error → the server message is shown and the form keeps the values.
- [x] Lint passes.
