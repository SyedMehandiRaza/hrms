# 12: Employee drafts API

**What to build:** A half-filled Add Employee wizard can be saved and resumed later by anyone allowed to create
employees (D53).

**Blocked by:** 01 Schema changes

**Status:** done

- [x] When a user with `employee:create` saves a draft on step 2 with only a name → 201; no field validation runs.
- [x] Saving again updates the same draft (step, data, last saved, saved by).
- [x] The list shows name (or "Untitled"), progress "step x of 5", last saved and saved by, newest first.
- [x] Another user with `employee:create` in the same company can open and resume it.
- [x] Data over 1 MB → 400 `VALIDATION_FAILED`, data "Draft is too large (max 1 MB)."
- [x] Deleting a draft removes it from the list.
- [x] `FORBIDDEN` without `employee:create`; another company's draft → `NOT_FOUND`.

Notes (2026-10-21): `GET/POST /employee-drafts`, `GET/PUT/DELETE /employee-drafts/:id`. Body `{ step (1–5), fullName?,
email?, data (object) }`. The name and email are copied from the wizard for the list and aren't validated. Items have `full_name`,
`email`, `current_step`, `total_steps` (5), `last_saved_at`, `saved_by { id, name }`, and `data` (detail only). The UI shows
"Untitled" when there's no name. Requests to this path accept bodies up to 2 MB, so data over 1 MB, even past the
request limit, is reported as the `data` field error. Tests: `backend/tests/employee-drafts.test.js`.
