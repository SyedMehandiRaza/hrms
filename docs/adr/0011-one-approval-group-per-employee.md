# 11. One approval group per employee, not per module (for now)

Date: 2026-10-20 · Status: Accepted

## Context
The schema and UI are built for module-based approval routing: groups carry a `module_key`, the Settings tab
binds a group per module × project with a company default, and `employee_approval_routing` allows per-module
overrides. The business wants something simpler: every employee has one approval group that approves all of
their requests, starting with exits.

## Decision
- Approval groups are **not tied to a module**. The group form's Module field offers only "All requests".
- Each employee has exactly one group, **required** at creation once the company has an active group. It's stored
  as one `employee_approval_routing` row with `module_key = 'ALL'`. Per-module routing is rejected by the server.
- *Amended 2026-10-20 (senior review):* a new company has no employees who could be approvers, so until its first
  active group exists the group may be empty. Requests from an employee without a group go to the owner only
  (decided via the owner override).
- The Settings tab (module × project bindings, company default) is out of scope. `hrms_approval_assignments`
  stays unused.
- A request freezes its group when it's raised. Levels use the group's live members (see the plan for skip and
  override rules).

## Consequences
- Turning on per-module routing later needs no schema change: add per-module rows and resolve the group as
  employee module override → employee ALL → project binding → company default.
- Until then, leave, overtime and other modules use the same single group.
