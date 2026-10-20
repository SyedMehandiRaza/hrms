# 04: Projects API

**What to build:** Admins create and manage projects, each tied to exactly one head office, with a server-generated
code, a photo and controlled status changes (D6–D12, D16).

**Blocked by:** 03 Head offices API; geo 03 Countries and cities API

**Status:** done

Field texts: `docs/standards.md` §7.2 "Project".

- [x] When a user with `project:create` creates a project on an Unassigned head office → 201 with code
      `PRJ-FY{yy}-0001` (yy = start year of the FY containing today, e.g. `FY26`); the next one gets 0002.
- [x] In a company whose FY runs April–March, a project created in February 2027 gets `PRJ-FY26-…`.
- [x] When the head office already has a project → 409 `PROJECT_OFFICE_TAKEN` "This head office already has a project."
- [x] A duplicate name (any case) → 409 `PROJECT_NAME_TAKEN` "A project with this name already exists."
- [x] 400 `VALIDATION_FAILED` with the §7.2 texts for: name (missing, under 2, over 255, double spaces, invalid
      characters), officeId missing, startDate / endDate missing, endDate before startDate ("End date must be after
      start date"; equal dates are accepted), location / lat / lng missing, radius missing, under 50 or over 100000,
      description over 1000.
- [x] Country (required, default company country) and optional city are saved; a city of another country → cityId
      "Select a city in the selected country."
- [x] A code sent by the client is ignored, and the code never changes on edit.
- [x] Photo: a JPG/PNG up to 2 MB is stored (old file deleted) and `DELETE` removes it; anything else → 400
      `PROJECT_IMAGE_INVALID` "Image must be a JPG or PNG up to 2 MB."
- [x] ACTIVE → ON_HOLD/COMPLETED, ON_HOLD → ACTIVE/COMPLETED and COMPLETED → ACTIVE succeed; any other change → 400
      `VALIDATION_FAILED` with status "This status change isn't allowed."
- [x] COMPLETED while an ACTIVE or IN_NOTICE employee has it as main project → 409 `PROJECT_HAS_EMPLOYEES`
      "Move this project's employees to another main project before completing it."
- [x] When COMPLETED succeeds → secondary assignments end today with REMOVED history rows; reopening doesn't restore them.
- [x] ON_HOLD succeeds with employees still assigned.
- [x] Moving the start date after an assignment's start → 409 `PROJECT_START_AFTER_ASSIGNMENTS`
      "Some employees were assigned before this date."
- [x] Passing the end date doesn't change the status.
- [x] Office options list only Unassigned head offices (plus the current one when editing).
- [x] List with search (name/code/location), status filter and stats (employee and contract-employee counts as in 03);
      detail includes the head office.
- [x] `FORBIDDEN` without `project:*` or for a STAFFING_COMPANY login; another company's project → `NOT_FOUND`.

Notes (2026-10-20): body `{ name, officeId, startDate, endDate, location, latitude, longitude, radius,
allowOfflineAttendance?, description?, countryId, cityId?, status? }` (the create/edit form has a status; it follows
the same transitions as `PATCH /projects/:id/status`; the same status again is no change). Office options:
`GET /projects/office-options?projectId=`. Stats: `total_projects, active_projects, on_hold_projects,
completed_projects, total_employees`. "Today" is the company-local date (`services/companyTime.service.js`,
`utils/clock.js`). The code needs the financial year containing today.
