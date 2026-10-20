# 21: Projects page, full list, create/edit

**What to build:** `/admin/projects` ("My projects" tab and stats), `/admin/projects/all` and
`/admin/projects/create-project` (also used for edit) use real data (D7–D12, D15).

**Blocked by:** 04 Projects API; geo 05 UI shared Country, City and Phone inputs

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] Stats and the latest projects (name + code, location, employees, contract employees, status) load from the API;
      "Assigned to me" stays as it is today.
- [ ] The full list searches by name/code/location and filters by Active / Completed / On Hold.
- [ ] When an admin creates a project → toast, it appears with a `PRJ-FY..-....` code; the form doesn't generate a code.
- [ ] The Office dropdown lists only Unassigned head offices (and the current one on edit).
- [ ] A Country select (default company country) comes before the existing City field, which lists that country's
      cities (approved UI addition).
- [ ] Duplicate name → "A project with this name already exists."; office already taken → "This head office already
      has a project."
- [ ] Field errors (dates, radius, description, missing office/location, `docs/standards.md` §7.2 "Project") show
      under the inputs.
- [ ] Uploading a project photo shows it after reload; a wrong file → "Image must be a JPG or PNG up to 2 MB."
- [ ] "On Hold" saves as ON_HOLD and shows as On Hold after reload.
- [ ] Completing a project that is someone's main project → "Move this project's employees to another main project
      before completing it."
- [ ] Moving the start date after an assignment → "Some employees were assigned before this date."
- [ ] "View project" on `/admin/projects` opens the detail page.
- [ ] No project permissions → buttons hidden; empty and error states.
- [ ] Lint passes.
