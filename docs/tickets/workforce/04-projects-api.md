# 04: Projects API

**What to build:** Admins create and manage projects, each tied to exactly one head office, with a server-generated
code, a photo and controlled status changes (D6–D12, D16).

**Blocked by:** 03 Head offices API; geo 03 Countries and cities API

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Project".

- [ ] When a user with `project:create` creates a project on an Unassigned head office → 201 with code
      `PRJ-FY{yy}-0001` (yy = start year of the FY containing today, e.g. `FY26`); the next one gets 0002.
- [ ] In a company whose FY runs April–March, a project created in February 2027 gets `PRJ-FY26-…`.
- [ ] When the head office already has a project → 409 `PROJECT_OFFICE_TAKEN` "This head office already has a project."
- [ ] A duplicate name (any case) → 409 `PROJECT_NAME_TAKEN` "A project with this name already exists."
- [ ] 400 `VALIDATION_FAILED` with the §7.2 texts for: name (missing, under 2, over 255, double spaces, invalid
      characters), officeId missing, startDate / endDate missing, endDate before startDate ("End date must be after
      start date"; equal dates are accepted), location / lat / lng missing, radius missing, under 50 or over 100000,
      description over 1000.
- [ ] Country (required, default company country) and optional city are saved; a city of another country → cityId
      "Select a city in the selected country."
- [ ] A code sent by the client is ignored, and the code never changes on edit.
- [ ] Photo: a JPG/PNG up to 2 MB is stored (old file deleted) and `DELETE` removes it; anything else → 400
      `PROJECT_IMAGE_INVALID` "Image must be a JPG or PNG up to 2 MB."
- [ ] ACTIVE → ON_HOLD/COMPLETED, ON_HOLD → ACTIVE/COMPLETED and COMPLETED → ACTIVE succeed; any other change → 400
      `VALIDATION_FAILED` with status "This status change isn't allowed."
- [ ] COMPLETED while an ACTIVE or IN_NOTICE employee has it as main project → 409 `PROJECT_HAS_EMPLOYEES`
      "Move this project's employees to another main project before completing it."
- [ ] When COMPLETED succeeds → secondary assignments end today with REMOVED history rows; reopening doesn't restore them.
- [ ] ON_HOLD succeeds with employees still assigned.
- [ ] Moving the start date after an assignment's start → 409 `PROJECT_START_AFTER_ASSIGNMENTS`
      "Some employees were assigned before this date."
- [ ] Passing the end date doesn't change the status.
- [ ] Office options list only Unassigned head offices (plus the current one when editing).
- [ ] List with search (name/code/location), status filter and stats (employee and contract-employee counts as in 03);
      detail includes the head office.
- [ ] `FORBIDDEN` without `project:*` or for a STAFFING_COMPANY login; another company's project → `NOT_FOUND`.
