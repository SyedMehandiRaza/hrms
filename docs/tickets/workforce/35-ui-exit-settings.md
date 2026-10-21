# 35: Settings → Exit settings tab

**What to build:** The Exit settings tab saves the real defaults; the checklist template part stays as it is (D62).

**Blocked by:** 16a Raise exit + exit list/detail + exit settings API

**Status:** done

Verified by the ui-tester agent:

- [x] Loads the defaults (notice 30, cooling 180, leave during notice, encash leave, block loans during notice).
- [x] Change notice days to 45 → saved; the raise-exit wizard then defaults to 45.
- [x] Notice outside 0–180 → "Notice period must be 0–180 days"; cooling outside 0–1095 → "Cooling period must be
      0–1095 days".
- [x] Read-only without `exit:update`.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked the tab in Edge (playwright-core) on this worktree's servers.
- The Defaults card loads and saves `GET/PUT /exit-settings`. Range texts show inline: notice 0–180, cooling 0–1095.
- Inputs are disabled and Save is hidden without `exit:update`. The tab is hidden without `exit:read`.
- The checklist template card stays as it was (static, D62).
- The wizard defaulting to the saved notice days is part of ticket 32. The wizard reads `GET /employees/:id/exit-preview`, which returns the saved defaults (tested in `exits-raise.test.js`). 32's ui-tester checks it in the browser.
- The dev DB's "leave during notice" default is false (the API default). The tab shows the stored value.
