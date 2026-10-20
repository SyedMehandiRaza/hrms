# 20: Head offices screens

**What to build:** `/admin/head-offices` and `/admin/head-offices/create-head-office` (plus the edit/view modal) use
real data (D1–D6).

**Blocked by:** 03 Head offices API; geo 05 UI shared Country, City and Phone inputs

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] Loading state, then the four stat cards and the list (name + project name, location, employees, contract
      employees, Active/Unassigned status).
- [ ] When an admin creates "Riyadh HQ" → success toast, back on the list as Unassigned.
- [ ] Creating it again → "A head office with this name already exists." under the name.
- [ ] Field errors under the inputs for name, email, phone and location (`docs/standards.md` §7.2 "Head office");
      a wrong image → "Image must be a JPG or PNG up to 2 MB."
- [ ] Uploading a photo shows it after reload; removing it clears it.
- [ ] Create and edit use the shared Country → City and Phone inputs (approved UI addition); a city and phone saved
      with Saudi Arabia show again after reload.
- [ ] Edit through the modal → saved and the list refreshes.
- [ ] Deleting an Unassigned office → confirm → removed; deleting one with a project → "This head office has a project
      and can't be deleted."
- [ ] A user without office permissions doesn't see add/edit/delete; a direct API call shows
      "You don't have permission to do this."
- [ ] Empty state with no offices; load error state with retry.
- [ ] Lint passes.
