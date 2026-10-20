# 35: Settings → Exit settings tab

**What to build:** The Exit settings tab saves the real defaults; the checklist template part stays as it is (D62).

**Blocked by:** 16a Raise exit + exit list/detail + exit settings API

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] Loads the defaults (notice 30, cooling 180, leave during notice, encash leave, block loans during notice).
- [ ] Change notice days to 45 → saved; the raise-exit wizard then defaults to 45.
- [ ] Notice outside 0–180 → "Notice period must be 0–180 days"; cooling outside 0–1095 → "Cooling period must be
      0–1095 days".
- [ ] Read-only without `exit:update`.
- [ ] Lint passes.
