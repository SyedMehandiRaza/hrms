# 21: Projects page, full list, create/edit

**What to build:** `/admin/projects` ("My projects" tab and stats), `/admin/projects/all` and
`/admin/projects/create-project` (also used for edit) use real data (D7–D12, D15).

**Blocked by:** 04 Projects API; geo 05 UI shared Country, City and Phone inputs

**Status:** done

Verified by the ui-tester agent:

- [x] Stats and the latest projects (name + code, location, employees, contract employees, status) load from the API;
      "Assigned to me" stays as it is today.
- [x] The full list searches by name/code/location and filters by Active / Completed / On Hold.
- [x] When an admin creates a project → toast, it appears with a `PRJ-FY..-....` code; the form doesn't generate a code.
- [x] The Office dropdown lists only Unassigned head offices (and the current one on edit).
- [x] A Country select (default company country) comes before the existing City field, which lists that country's
      cities (approved UI addition).
- [x] Duplicate name → "A project with this name already exists."; office already taken → "This head office already
      has a project."
- [x] Field errors (dates, radius, description, missing office/location, `docs/standards.md` §7.2 "Project") show
      under the inputs.
- [x] Uploading a project photo shows it after reload; a wrong file → "Image must be a JPG or PNG up to 2 MB."
- [x] "On Hold" saves as ON_HOLD and shows as On Hold after reload.
- [x] Completing a project that is someone's main project → "Move this project's employees to another main project
      before completing it."
- [x] Moving the start date after an assignment → "Some employees were assigned before this date."
- [x] "View project" on `/admin/projects` opens the detail page.
- [x] No project permissions → buttons hidden; empty and error states.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers
(UI :5180, API :5100).
- Fixed during verification: both project forms have `noValidate`, so our inline messages show instead of the
  browser's radius tooltip. The missing map point and missing office messages now show together.
- Edit stays in the existing Edit modal; the create page isn't reused.
- "View project" opens `/admin/projects/project-detail/:id`.
- The Workforce, Distribution and Attendance cards on `/admin/projects` belong to other modules and still use static
  data.
- Permissions were checked with a mocked read-only role: create and edit are hidden, and direct API calls from
  employee/staffing logins get 403.
- Seed note: the seeded Riyadh project's start date (2025-03-01) is after its employees' assignment dates, so any save
  of it returns "Some employees were assigned before this date." until its start date is moved earlier.
- Changed files lint clean.
