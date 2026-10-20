# 10. One project per head office (1:1)

Date: 2026-10-20 · Status: Accepted

## Context
The UI's head office list can show several project names per office, and the backend plan had already
removed the legacy circular 1:1 (`offices.project_id` + unique `projects.office_id`) so that one office could
hold many projects.

## Decision
- A head office is linked to **at most one** project, and a project belongs to **exactly one** head office.
  Enforced by a unique key on `projects.office_id` (NOT NULL).
- A head office with no project is "Unassigned"; one with a project is "Active". Status is derived, not stored
  (`offices.status` is dropped).
- A head office can be deleted only while Unassigned (`OFFICE_IN_USE`). To free one, move its project to
  another head office.

## Consequences
- The project form's Office dropdown lists only Unassigned head offices (plus the project's current one on edit).
- Moving to one-to-many later means dropping the unique key and re-introducing a stored status. That's cheap
  in the schema, but every screen and report that assumes "the office's project" has to change.
