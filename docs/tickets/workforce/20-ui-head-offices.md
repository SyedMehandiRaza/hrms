# 20: Head offices screens

**What to build:** `/admin/head-offices` and `/admin/head-offices/create-head-office` (plus the edit/view modal) use
real data (D1–D6).

**Blocked by:** 03 Head offices API; geo 05 UI shared Country, City and Phone inputs

**Status:** done

Verified by the ui-tester agent:

- [x] Loading state, then the four stat cards and the list (name + project name, location, employees, contract
      employees, Active/Unassigned status).
- [x] When an admin creates "Riyadh HQ" → success toast, back on the list as Unassigned.
- [x] Creating it again → "A head office with this name already exists." under the name.
- [x] Field errors under the inputs for name, email, phone and location (`docs/standards.md` §7.2 "Head office");
      a wrong image → "Image must be a JPG or PNG up to 2 MB."
- [x] Uploading a photo shows it after reload; removing it clears it.
- [x] Create and edit use the shared Country → City and Phone inputs (approved UI addition); a city and phone saved
      with Saudi Arabia show again after reload.
- [x] The City select (first used here, carried from geo 05) loads the chosen country's cities as you type; changing
      the country clears the city; a country with no cities (e.g. France) shows "No cities available".
- [x] Edit through the modal → saved and the list refreshes.
- [x] Deleting an Unassigned office → confirm → removed; deleting one with a project → "This head office has a project
      and can't be deleted."
- [x] A user without office permissions doesn't see add/edit/delete; a direct API call shows
      "You don't have permission to do this."
- [x] Empty state with no offices; load error state with retry.
- [x] Lint passes.

Notes (2026-10-21): wired — `api/offices.js`, shared rules `utils/officeRules.js` (same §7.2 texts as the server),
list/create/edit modal on the API with Country → City and Phone inputs, photo upload/remove, delete, load error +
retry. Changed files lint clean (the full `npm run lint` still has 41 errors in files this ticket doesn't touch).
**Not closed:** the ui-tester agent had no browser (Playwright) tools in this session, so no flow has been verified
yet. Next step: run ui-tester on this ticket, fix any FAILs, then tick the boxes and set `done`.

Notes (2026-10-21, second attempt): re-ran ui-tester — again BLOCKED on all criteria. The session has no
Playwright/browser tools, no `playwright` package in hrms/ or backend/, and shell commands (curl, `npm run dev`) need
interactive approval. Changed files still lint clean; backend lint clean. **Needs:** a session with Playwright MCP
tools (or pre-approved `npx playwright` + dev-server commands). ui-tester's test-data hints: admin
`admin@hrms.test`; "Riyadh Head Office" has a project (for the delete-blocked case); no seeded user lacks office
permissions — `employee@hrms.test` or `staffing@hrms.test` are the candidates for the no-permission criterion.

Notes (2026-10-21, third attempt): BLOCKED again. Still no Playwright/browser tools; curl/wmic/netstat-by-PID need
approval. Ports 5000 and 5173 are already held by other processes (likely other worktrees), so `npm run dev` here
landed on 5175 and it couldn't be confirmed which code the standard ports serve. Backend lint clean. **Question for the
user:** please run ui-tester from an interactive session with Playwright, with this worktree's servers on
5000/5173 — or say whether UI tickets may close on lint + manual check. Every remaining open ticket (20–36) is a UI
ticket that needs ui-tester, so none can close in the current setup.

Notes (2026-10-21, fourth attempt): ui-tester BLOCKED again for the same reason (no Playwright/browser tools, shell
commands need approval). The question above to the user is still open.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) against this worktree's
servers (UI :5180, API :5100). All criteria pass after two fixes:
- If the server rejects a photo after the office is created, only the server's "Image must be a JPG or PNG up to
  2 MB." toast shows. The app shows one toast at a time, so before this the error was hidden behind the success toast.
- In the Edit modal, the saved city shows only while it is still the chosen value. Switching the country away and
  back now shows "Select city".

Permissions:
- A sub-admin without office delete sees no delete icon.
- A read-only role (mocked `/auth/me`) sees no Create button and only the view icon.
- Employee and staffing tokens calling the API get 403 "You don't have permission to do this.".
- No seeded admin-panel login lacks office read.

The empty state uses the screen's existing text "No head offices match your filters.", even when no filter is set.

`npm run lint`: the changed files are clean. The 41 errors that remain are pre-existing, in files this ticket doesn't
touch (the baseline gate is "no new problems").
