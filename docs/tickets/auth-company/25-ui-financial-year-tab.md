# 25: Financial Year tab: timezone and start month

**What to build:** On Settings → Financial Year, the settings card loads the real time settings and saves
timezone and start month. The tab's other fields and panels are left as they are for the Financial Year module
(D30).

**Blocked by:** 14 UI foundation, 11 Time settings API

**Status:** in-progress

Verified by the ui-tester agent:

- [ ] The card shows the loading state, then the company's timezone and start month.
- [ ] Owner changes timezone and start month → Save → success; reloading shows both. (The years list stays
      static until the Financial Year module.)
- [ ] With a closing or closed year, the start month is disabled with "The start month can't change after a
      financial year has been closed."
- [ ] Invalid values show "Choose a valid timezone" / "Choose a month from 1 to 12" under the field.
- [ ] A sub-admin without financial-year update sees the card read-only.
- [ ] Server error → the server message is shown and the form keeps the values.
- [ ] Lint passes.
