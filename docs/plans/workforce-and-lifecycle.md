# Plan: Workforce structure + Employee lifecycle

Status: **Agreed 2026-10-20** (grilling session, 36 questions + follow-ups; senior review 2026-10-20, 25 fixes,
see §8). Open questions: **0** (deferred items in §6).
Scope: head offices, projects, shifts, leave types/policies, salary components, approval groups + engine,
employee creation/edit, exit (resignation/termination), rehire.
Rules shared by all modules: `docs/standards.md`. Terms: `docs/CONTEXT.md`. Reasons: `docs/adr/0010`, `0011`.
Out of scope: salary calculation, payroll runs, attendance screens, employee documents, exit checklist/documents/settlement.

---

## 1. Decisions

### Head office
1. **No code.** Name is the identifier.
2. **1:1 with project** (ADR 10): a head office has at most one project; a project has exactly one head office.
   Unique, NOT NULL `projects.office_id`.
3. Status is **derived**: Active = has a project, Unassigned = none. `offices.status` is dropped.
4. **Delete only, no deactivate.** Allowed while Unassigned (soft delete, name reusable via `live_key`);
   otherwise 409 `OFFICE_IN_USE`.
5. Fields (server applies the UI rules): name required 2–100, `[A-Za-z0-9']` with single spaces, unique per company
   case-insensitive (`OFFICE_NAME_TAKEN`); email required, valid, lowercased, not unique; phone required, calling
   code + 6–15 digits; location required 3–255 `[A-Za-z0-9,\s-]`; lat/lng optional; photo optional JPG/PNG ≤ 2 MB
   (`OFFICE_IMAGE_INVALID`), stored through the storage service like the company logo.
6. List stats are the UI's four: total offices, active offices (= with a project), total locations (distinct
   office locations, trimmed, case-insensitive), total projects. Per office/project, **employees** = ACTIVE + IN_NOTICE
   employees with a current assignment (main or secondary) on the project; **contract employees** = those of them
   with employment type CONTRACT (not Contract Studio contracts).
   Image: `PUT /offices/:id/image` stores it (old file deleted), `DELETE` removes it.

### Project
7. Status `ACTIVE | ON_HOLD | COMPLETED`. UI "On Hold" sends `ON_HOLD`; `INACTIVE` is dropped.
   ACTIVE: assign employees, pick as main project, new attendance/overtime. ON_HOLD and COMPLETED: none of these;
   existing assignments and history are kept. Transitions: ACTIVE → ON_HOLD | COMPLETED; ON_HOLD → ACTIVE | COMPLETED;
   COMPLETED → ACTIVE (reopen).
8. **COMPLETED** is blocked while any ACTIVE or IN_NOTICE employee has it as main project (`PROJECT_HAS_EMPLOYEES`).
   Secondary assignments are ended today with `REMOVED` history rows. **ON_HOLD** is allowed with employees.
9. Name: UI rules (2–255, allowed characters, no double spaces), unique per company (`PROJECT_NAME_TAKEN`).
10. Code: **server-generated** `PRJ-FY{yy}-{NNNN}`, sequential per company per FY (`hrms_number_sequences`, new
    value `PROJECT`), immutable. The FY is the one containing the creation date; `yy` = last two digits of that FY's
    **start** year (Apr 2026–Mar 2027 → `FY26`). The UI stops generating it.
11. Start and end dates are required, end ≥ start. The end date is a **target**: it doesn't auto-complete the project and
    can be extended. Moving the start after any assignment's start → `PROJECT_START_AFTER_ASSIGNMENTS`.
    Other fields follow the UI rules: map location/lat/lng required, radius 50–100000, city optional, allow offline,
    description ≤ 1000. Photo: `PUT/DELETE /projects/:id/image`, JPG/PNG ≤ 2 MB by magic bytes
    (`PROJECT_IMAGE_INVALID`), same storage service as the office image.
12. Office dropdown: only Unassigned head offices, plus the current one on edit. A taken office → `PROJECT_OFFICE_TAKEN`.
13. Assign (Project Detail): adds a **secondary** project starting today and writes an `ASSIGNED` row. Already
    assigned = no-op. Only ACTIVE projects (`PROJECT_NOT_ACTIVE`). GENERAL_EMPLOYEE may have only one project
    (`PROJECT_GENERAL_EMPLOYEE_SINGLE`). IN_NOTICE/EXITED employees can't be assigned.
14. Remove: the assignment ends today and writes a `REMOVED` row. Removing the employee's main project is blocked
    (`PROJECT_REMOVE_MAIN`).
15. In scope: My projects tab and stats, list/search/filter, create/edit, detail info, workforce table with
    assign/remove. The workforce Status column shows employment status (Active / In notice). Static/empty for now:
    the "Assigned to me" tab (collaboration), attendance summary, payroll cost, Staffing-portal project pages.
16. `project:read` sees all of the company's projects. No per-project data scope.

### Approval groups (ADR 11)
17. Groups are **not tied to a module**. The form's Module dropdown offers only "All requests". The Settings tab
    (module × project bindings, company default) is out of scope.
18. Each employee has **one** group, stored as `employee_approval_routing(module_key='ALL')`. It is **required once
    the company has at least one active group**; before that (a new company has no employees to be approvers) it may
    be empty. A request from an employee with no group goes straight to the **owner** (owner-only request, decided via
    the override, D27). Edit info can set the group later. Per-module routing → `APPROVAL_ROUTING_PER_MODULE_DISABLED`.
19. Name 2–100, unique per company including inactive groups (`APPROVAL_GROUP_NAME_TAKEN`; groups are never deleted, so
    no `live_key`). Code required, 2–50, uppercased, unique per
    company (`APPROVAL_GROUP_CODE_TAKEN`). Description ≤ 1000.
20. Scope GLOBAL | PROJECT. A PROJECT group needs a project and at least one approver on it, and can be routed only to
    employees whose main project is that project (`APPROVAL_GROUP_PROJECT_MISMATCH`). If the main project later
    changes, the group stays; the Edit modal shows a warning.
21. Members: at least one; ACTIVE or IN_NOTICE employees of the company; no duplicate employee; levels contiguous
    from 1 ("Levels must start at 1 with no gaps.").
22. "Deactivate" sets `is_active=false`; there's no hard delete. An inactive group can't be newly routed. Deactivating a
    group with pending requests, or one that is routed to any non-exited employee, → `APPROVAL_GROUP_IN_USE`.
    A group with a level that has no active approver is flagged "Level n has no active approver."
    An inactive group can be reactivated (`PATCH /approval-groups/:id/status`).
22a. **Edits while requests are pending:** a members change that removes a level a pending request is at or still
    needs → 409 `APPROVAL_GROUP_HAS_PENDING`. Any other members change (and the LWD job, D63) re-evaluates pending
    requests at once: a level with nobody left who can act is skipped (can_skip) or blocks (D26).

### Approval engine
23. Levels run in order. Only the current level's approvers see the request in their inbox.
24. A level is approved when **every mandatory** approver at it has approved; with no mandatory approvers, **any
    one** approver is enough.
25. Any rejection → request `REJECTED` with a required reason (5–500).
26. Unavailable approvers: the **requester / subject employee** never acts on their own request, and **EXITED**
    approvers drop out (IN_NOTICE approvers can still act). If a level has nobody left who can act: **can_skip**
    → auto-`SKIPPED` (logged); otherwise it blocks.
27. **Owner override**: the ADMIN can approve or reject the current level on anyone's behalf, logged with a
    required reason (5–500). This also unblocks blocked levels. No delegation for leave yet. The owner has **no
    employee record**, so requests record the raiser as a user (`requested_by_user_id`; `requested_by` employee is
    optional) and log rows carry `actor_user_id` + `is_override` (member/employee optional on override rows).
28. A request freezes `approval_group_id` when raised. Current and future levels use the group's **live** members;
    past log entries never change.
29. New module key `EXIT` for requests (`entity_type = 'EMPLOYEE_EXIT'`). The inbox shows request type "Exit".
    The engine is generic: each entity type supplies its label and email text; L1 approvers are emailed when a
    request is raised, later levels when it reaches them.

### Leave types and policies
30. **Exactly one policy per leave type**, edited together in the modal. **No versioning:** edits change the
    policy in place and affect future accruals only. "Save as new version" → `LEAVE_POLICY_VERSIONING_DISABLED`
    (the button stays).
31. Fields: name 2–150, no emoji, unique (`LEAVE_TYPE_NAME_TAKEN`); code 1–10 `A-Z0-9`, uppercased, unique
    (`LEAVE_TYPE_CODE_TAKEN`); paid/unpaid, half day, requires document, negative balance, prorate joiners;
    quota 0–365; monthly accrual ≥ 0 (ignored for UPFRONT); effective from (default FY start) / to (> from or empty);
    carry forward: max > 0, expiry 0–36 months; encashment: max > 0; year-end excess LAPSE | ENCASH.
32. Inactive = not newly assignable; existing assignments are kept. Delete is blocked if the policy was ever assigned
    (`LEAVE_TYPE_IN_USE`). Page stat cards stay static. Permission `leave_type:*`.
33. Employee assignment: at least one active policy, at most one per type; assignment runs from the joining date.
    Removing one sets its end date to today and keeps the balance.
34. A balance row for the current FY is created at assignment. UPFRONT: quota credited now, prorated when
    `prorate_joiners` (`quota × days left in FY ÷ days in FY`, rounded down to 0.5). MONTHLY_ACCRUAL: starts at 0;
    credits come from the Leave module's accrual job. Each credit writes a `CREDIT` ledger row (source SYSTEM).
    A backdated joining date in a previous FY creates the current FY only (proration from that FY's start).
    A future joining date creates the balance of the FY that **contains the joining date**; proration counts from the
    joining date to that FY's end. If that FY row doesn't exist yet, no balance is created now (the Leave module
    creates it when the FY opens — deferred).

### Shifts
35. Name 1–50, unique per company (`SHIFT_NAME_TAKEN`). Start and end required; end < start = overnight; equal
    times are rejected ("End time must differ from start time.").
36. Changing times needs `effective_from` (default today, ≥ FY start, not in a closed or locked period). It adds a
    `hrms_shift_time_history` row. Current times = latest row ≤ today; future rows show "Scheduled". Name-only edits
    add no row.
37. Delete is blocked while a non-exited employee has the shift (`SHIFT_IN_USE`); otherwise a soft delete. No
    default shift for new companies. Permission `shift:*`.
38. Week-offs: saving replaces that shift's dates for the shown FY **from today onward**. Past or locked dates can't
    change (`SHIFT_WEEKOFF_LOCKED`). Dates must fall in an existing FY.
39. Copy to next year: `GET /shifts/week-offs/copy-preview?to_fy` (weekdays off on at least 80% of their
    occurrences in the source FY) and `POST /shifts/week-offs/copy {to_fy, shift_ids}`, which only adds dates. Only
    when the next FY exists and isn't locked.
40. Employee shift is optional. On create: history row effective from the joining date. On edit: effective today;
    a same-day change overwrites that day's row; clearing writes no row. The shift must exist in the company.

### Salary components
41. Name 2–100, no emoji, unique (`SALARY_COMPONENT_NAME_TAKEN`); type EARNING | DEDUCTION, locked once
    used (`SALARY_COMPONENT_TYPE_LOCKED`); description ≤ 255. Code is server-generated from the name (uppercase,
    `_`, suffix on clash), immutable, and not shown.
42. Starter set for every company (seeded at sign-up; data migration for existing companies):
    | Component | Code | Type | Kind |
    |---|---|---|---|
    | Basic Salary | BASIC | Earning | **default**, amount > 0 |
    | Housing Allowance | HOUSING | Earning | **default**, ≥ 0 |
    | Transport Allowance | TRANSPORT | Earning | **default**, ≥ 0 |
    | Hourly | HOURLY | Earning | system, HOURLY mode only |
    | Food Allowance | FOOD | Earning | optional |
    | Other Allowance | OTHER_ALLOWANCE | Earning | optional |
    | GOSI Contribution | GOSI | Deduction | optional |
    | Salary Advance Recovery | ADVANCE | Deduction | optional |
    | Absence Deduction | ABSENCE | Deduction | optional |
    **Defaults** are the wizard's first locked rows in monthly modes: you fill in the amount, and they can't be
    removed, swapped or picked again. Defaults and Hourly are `is_system`: "Default" badge, no edit or deactivate
    (`SALARY_COMPONENT_SYSTEM`). New column `hrms_salary_components.is_default`.
43. "Delete" = deactivate. Inactive components can't be added to new salaries. Permission `salary:*` (the UI gate
    changes from `payroll` to `salary`).

### Employee
44. Scope of the wizard: Basic, Job, Salary, approval group, login, drafts. **Documents step isn't saved** (deferred).
45. Employee ID `employee_code` is **server-generated** `EMP-0001…` per company (sequence value `EMPLOYEE`),
    never reused or edited. `country_emp_id` (Iqama / national ID / passport) is entered, 3–10 `A-Z0-9-`,
    uppercased, unique per company (`EMPLOYEE_ID_NUMBER_TAKEN`).
46. Email required: one current account per email (ADR 2) → `ACCOUNT_EMAIL_IN_OTHER_COMPANY` or
    `EMPLOYEE_EMAIL_TAKEN`. Phone required, unique per company (`EMPLOYEE_PHONE_TAKEN`). The step-1 duplicate check
    uses the same rules (`GET /employees/check-unique`).
47. Every employee gets a login: temporary password + setup link (ADR 3). If the person already has a password
    (ADR 2), just a welcome email. Resend from Employee Detail (`employee:update`).
48. Access level: EMPLOYEE | GENERAL_EMPLOYEE | SUB_ADMIN. ADMIN → `ACCOUNT_ADMIN_EXISTS`; STAFFING_COMPANY (or any
    other) → field error. Only the **owner** may create or promote SUB_ADMIN (others → `FORBIDDEN`). Role: optional
    for EMPLOYEE / GENERAL_EMPLOYEE (no role = every flag false, Auth D7), **required for SUB_ADMIN**; when given it
    must be a company role. Roles and staffing companies come from read-only lookups (`GET /roles`,
    `GET /staffing-companies?status=ACTIVE`); their full modules are planned separately.
    GENERAL_EMPLOYEE = exactly one project; changing someone to GENERAL_EMPLOYEE while they have more than one current
    project → `PROJECT_GENERAL_EMPLOYEE_SINGLE`.
49. Projects: at least one, all ACTIVE, main project among them. Joining date optional (empty = today),
    ≤ today + 12 months, ≥ main project start ("Joining date can't be before the main project's start date.").
    Assignments start on the joining date and write `ASSIGNED` rows; the main period starts then.
50. Department and designation active, designation in that department; staffing company only for CONTRACT,
    must be active.
51. Approval group **required** once the company has an active group (D18) (`approvalGroupId: "Select an approval
    group."`, also for an unknown or inactive group); a PROJECT group must match the main project
    (`APPROVAL_GROUP_PROJECT_MISMATCH`). Routing hint copy: "This group approves all of this employee's requests."
52. Salary (monthly modes). Currency **SAR only** ("Currency must be SAR."; the wizard default becomes SAR).
    Mode matrix: Full-time → MONTHLY_FIXED | MONTHLY_HOURLY; Contract → MONTHLY_HOURLY | HOURLY; Contract with
    staffing company → HOURLY. Working hours > 0 and ≤ 24 (Monthly hourly). Hourly rate > 0; min hours ≥ 0. OT rate
    1–5 in 0.5 steps (default 1.5, 1 for staffing) on `employees.overtime_rate`. Rows: active components, no
    duplicates, amount ≥ 0, Basic > 0, PERCENTAGE = % of Basic ≤ 100, `percent_base=["BASIC"]`. Saved effective
    from the joining date. **Not editable after creation** until Salary Increments (Payroll module).
53. Drafts: save on any step with no field validation; JSON ≤ 1 MB; shared within the company (`employee:create`);
    no expiry. Create = one transaction (user → account → employee → projects + history → leave + balances +
    ledger → shift + history → salary + components → routing → delete draft). Email is sent after commit.
54. Edit info: same job-field rules; leave add/remove per D33; salary not editable.
55. **Main project change** (Edit): new "Effective from" date (default today) shown when the main project changes
    (approved UI addition). The new project must be ACTIVE (added if not assigned); the old main becomes secondary.
    The date must be after the current main period's start, not in the future, not in a locked period. Writes
    `MOVED_OUT`/`MOVED_IN` with `effective_date`, and a new period in `hrms_employee_main_project_periods`. Records
    dated before the change stay on the old project. For a **GENERAL_EMPLOYEE** the old main assignment is ended
    (`REMOVED`, day before the effective date) instead of staying secondary.
56. List: filters project (main or secondary), type, role, status (Active / In notice / Exited), search (name,
    Employee ID, Iqama, email). Bulk Deactivate = account SUSPENDED + sessions revoked (still a current account);
    Activate = ACTIVE; owner protected; `employee:update`. Bulk is **all-or-nothing**: every id is checked first and
    one exited employee fails the whole batch.
56a. **EXITED employees are read-only**: edit, main-project change, resend login and (de)activate → 409
    `EMPLOYEE_EXITED` "This employee has exited. Use Rehire." IN_NOTICE employees can be changed normally.
57. The Employee panel shows only the employee's own profile. STAFFING_COMPANY logins get `FORBIDDEN` on every
    endpoint of this plan, whatever their role (as in Auth + Company).

### Exit
58. Raise via the wizard → exit `PENDING_APPROVAL` + approval request to the **leaving employee's** group (or an
    owner-only request when they have none, D18). The employee is unchanged until approved.
59. Final approval → `IN_NOTICE` (employee IN_NOTICE). If LWD < today → processed immediately (D63). Rejection →
    `REJECTED` with reason; a new exit can be raised. Withdraw while pending (the raiser, the owner, or anyone with
    `employee:create` + `employee:update`; reason 5–500) → exit `CANCELLED`, approval request `CANCELLED` (leaves every
    inbox, past log rows kept), exit event `WITHDRAWN`. One open exit (PENDING_APPROVAL or IN_NOTICE) per employee
    (`EXIT_ALREADY_OPEN`), also under concurrent raises.
60. UI additions (approved): a "Pending approval" tab on the Exit list (Rejected shows under Cancelled); the wizard's
    last button reads "Submit for approval".
61. Types: RESIGNATION | TERMINATION. Reasons: resignation = BETTER_OPPORTUNITY, PERSONAL, RELOCATION, HEALTH,
    OTHER; termination = PERFORMANCE, MISCONDUCT, REDUNDANCY, CONTRACT_END, **ABSCONDING**, OTHER. Reason text
    10–1000.
62. Notice: days 0–180 (default from Exit settings, 30); LWD = start + max(days, 1) − 1 (0 days → LWD = start),
    editable, ≥ start and ≤ start + 365; start
    within ±90 days of today; LWD in the past only for the owner. Exit settings tab in scope (defaults only; the checklist
    template is deferred). Settlement choices are saved; the preview shows "Available after Payroll".
63. **LWD job** (daily, just after midnight in company TZ) for IN_NOTICE exits with LWD < today, one transaction each:
    exit and employee → `EXITED`, `exit_date` = LWD; account → `INACTIVE` (ended, ADR 2) + all sessions revoked;
    all assignments and the main period end at LWD with `REMOVED` rows; approval-group memberships deactivated;
    department head cleared; `rehire_allowed_from` = exit date + cooling days + 1. No attendance or overtime may be
    dated after LWD (rule for those modules). The same "process exit" service runs at final approval, edit terms and
    Confirm Immediate when the LWD is already past. Scheduling: `node-cron` hourly tick in the server (off when
    `JOBS_ENABLED=false`, always off in tests), processing each company whose local date has moved on (idempotent);
    `runLwdJob({ now })` for tests; `npm run job:lwd` for dev and the ui-tester.
64. Confirm → **Immediate** (owner, reason 10–500): LWD = today, processed now. Checklist, exit documents and
    COMPLETED are deferred; **EXITED is final for now**.
65. In notice: Edit terms (`employee:create` + `employee:update`, no re-approval; `original_last_working_day` kept;
    each change is an exit event; LWD bounds as D62, past LWD owner-only and processed at once). Cancel (reason 5–500) → `CANCELLED`, employee back to ACTIVE. Handover warnings (groups, pending
    approvals on them, departments headed, projects) are **warnings only**. The employee works normally during notice.
66. Who raises: **any login linked to an ACTIVE employee record** (SUB_ADMIN, EMPLOYEE, GENERAL_EMPLOYEE) may raise
    their own **resignation** (API now; Employee-panel screen is a later UI ticket). The owner has no employee record:
    they can't resign and nobody can raise an exit for them. A termination for yourself → field `employeeId`
    "You cannot raise an exit for yourself". Raising for someone else (resignation or termination), editing terms and cancelling needs
    `employee:create` **and** `employee:update`.
67. **Rehire** (`employee:create`): same employee record and Employee ID. Needs exit EXITED (`EXIT_INVALID_STATE`),
    `rehire_eligible` (`REHIRE_NOT_ELIGIBLE`), rehire date ≥ `rehire_allowed_from` (`REHIRE_NOT_ALLOWED`) and
    ≤ today + 90 days (field "Rehire date cannot be more than 90 days ahead"; empty = today), and no current account
    elsewhere (ADR 2). Job fields are kept when still valid: employment type; access level (SUB_ADMIN only if the
    owner rehires, else EMPLOYEE); role, department, designation, staffing company if still active (else cleared;
    the designation is cleared with its department). The rehire form may override any of them under the create
    rules. Secondary projects are not restored.
    Employee → ACTIVE, joining date = rehire date, same account reactivated with a new temporary password/setup link.
    Main project = the chosen one or the last main if it's ACTIVE, otherwise required ("Select an active main project.").
    Approval group, shift, salary (new row from the rehire date) and leave policies are kept if still active; balances
    start fresh.

### Notifications (email only)
68. Current-level approvers: "An exit request for {employee} needs your approval." Raiser: approved/rejected
    (+ reason). The leaving employee is told about a termination raised by someone else **only after final approval**
    (it's hidden from their own views while pending); their own resignation is visible throughout. No email at LWD.

---

## 2. Permission matrix

ADMIN (owner) bypasses everything. STAFFING_COMPANY logins are refused everywhere (D57).

| Action | Permission |
|---|---|
| Roles and staffing-company lookups (read-only lists for the wizard) | `employee:create` or `employee:update` |
| Head offices CRUD | `office:*` |
| Projects read/create/update; assign/remove employees | `project:read/create/update`; assign/remove `project:update` |
| Approval groups | `approval_group:*` |
| Leave types/policies | `leave_type:*` |
| Shifts, week-offs, copy | `shift:*` |
| Salary components | `salary:*` |
| Employees read · create · edit, bulk (de)activate, resend login | `employee:read` · `employee:create` · `employee:update` |
| Create/promote SUB_ADMIN; Confirm Immediate; backdated LWD | owner only |
| Raise exit for someone else, edit terms, cancel | `employee:create` **and** `employee:update` |
| Raise own resignation | any login with an ACTIVE employee record |
| Withdraw a pending exit | its raiser, the owner, or `employee:create` **and** `employee:update` |
| Exit list/detail | `exit:read` (new module) |
| Exit settings | `exit:update` |
| Rehire | `employee:create` |
| Approve/reject a request | current-level approvers of that request; owner override |

---

## 3. Schema changes (migrations)
- `projects`: `office_id` NOT NULL + unique; status enum → `ACTIVE, ON_HOLD, COMPLETED` (map existing `INACTIVE` → `ON_HOLD`).
- `offices`: drop `status`; generated `live_key`; unique `(employer_id, office_name, live_key)`.
- `projects`: generated `live_key`; unique `(employer_id, project_name, live_key)`.
- `hrms_number_sequences`: + `PROJECT`, `EMPLOYEE`; `financial_year_id` nullable (EMPLOYEE uses one row per company
  with NULL FY; unique key via a generated column so NULL FYs don't duplicate). Existing companies start EMPLOYEE at
  their highest existing `EMP-` number.
- `employees.office_id`: **deprecated**, not read or written (an employee's head office = their main project's
  office). Dropped later.
- `hrms_approval_requests`: + `requested_by_user_id →users NN` (backfilled from the employee's user);
  `requested_by` nullable.
- `hrms_approval_request_logs`: + `actor_user_id →users`, + `is_override bool =0`; `approval_group_member_id` and
  `employee_id` nullable (override and owner-only rows).
- `hrms_exit_events.event_type`: + `APPROVED`, `REJECTED`, `WITHDRAWN`. `hrms_employee_exits.status` default →
  `PENDING_APPROVAL`.
- Data: an office with more than one project gets a copy "<name> (2)", "(3)"… per extra project; existing approval
  groups → `module_key='ALL'`; existing projects keep their codes. Seeders updated to match (second head office,
  one ALL group + routing rows for seeded employees, project codes `PRJ-FY26-0001/2`); `docs/test-users.md` updated.
- `hrms_employee_project_history`: + `effective_date DATEONLY`.
- New `hrms_employee_main_project_periods`: `employer_id`, `employee_id`, `project_id`, `date_from NN`, `date_to`;
  index `(employee_id, date_from)`.
- `hrms_employee_shift_history`: + `employer_id`.
- `hrms_salary_components`: + `is_default bool =0`; starter set seeded per company (sign-up + data migration).
- `hrms_approval_groups`: `module_key` → `'ALL'` for now; unique `(employer_id, group_name)` (no delete, no `live_key`).
- `hrms_employee_exits`: status + `PENDING_APPROVAL`, `REJECTED`; + `approval_request_id`, `reject_reason`.
- `modules`: + `exit`. Role seeds updated.

## 4. Endpoints
| Method & path | Who |
|---|---|
| `GET/POST /offices` · `GET/PUT/DELETE /offices/:id` · `PUT/DELETE /offices/:id/image` | `office:*` |
| `GET/POST /projects` · `GET/PUT /projects/:id` · `PATCH /projects/:id/status` · `PUT/DELETE /projects/:id/image` | `project:*` |
| `GET /roles` · `GET /staffing-companies?status=ACTIVE` (read-only lookups) | `employee:create` or `employee:update` |
| `POST /projects/:id/employees` · `DELETE /projects/:id/employees/:employeeId` | `project:update` |
| `GET/POST /shifts` · `GET/PUT/DELETE /shifts/:id` · `PUT /shifts/:id/week-offs` | `shift:*` |
| `GET /shifts/week-offs/copy-preview` · `POST /shifts/week-offs/copy` | `shift:update` |
| `GET/POST /leave-types` · `GET/PUT/DELETE /leave-types/:id` · `POST /leave-types/:id/versions` (→ disabled) | `leave_type:*` |
| `GET/POST /salary-components` · `GET/PUT/DELETE /salary-components/:id` | `salary:*` |
| `GET/POST /approval-groups` · `GET/PUT /approval-groups/:id` · `PUT /approval-groups/:id/members` · `PATCH /approval-groups/:id/status` | `approval_group:*` |
| `GET /approvals/inbox` · `POST /approvals/:requestId/approve` · `POST /approvals/:requestId/reject` | approvers / owner |
| `GET/POST /employees` · `GET/PUT /employees/:id` · `GET /employees/check-unique` · `POST /employees/bulk-status` · `POST /employees/:id/resend-login` | `employee:*` |
| `PUT /employees/:id/main-project` | `employee:update` |
| `GET/POST /employee-drafts` · `GET/PUT/DELETE /employee-drafts/:id` | `employee:create` |
| `GET /exits` · `GET /exits/:id` | `exit:read` |
| `POST /employees/:id/exits` | `employee:create`+`update`, or self (resignation) |
| `PUT /exits/:id/terms` · `POST /exits/:id/cancel` | `employee:create`+`update` |
| `POST /exits/:id/withdraw` | raiser, owner, or `employee:create`+`update` |
| `POST /exits/:id/confirm-immediate` | owner |
| `POST /exits/:id/rehire` | `employee:create` |
| `GET/PUT /exit-settings` | `exit:read` / `exit:update` |

## 5. Messages
New codes and exact texts: `docs/standards.md` §7.

## 6. Deferred (decide when their module is planned)
- Manager "own project team" data scope (roles have no data scope).
- Per-module approval routing, the Settings tab (module × project, company default), delegation while on leave.
- Leave-policy versioning; leave accrual job; leave requests.
- Salary edits (increments); payroll; other system components (Overtime, Loan EMI).
- Employee documents and document types.
- Exit checklist, exit documents, final settlement, COMPLETED status; Employee-panel self-resignation screen.
- In-app notifications.
- Cloudinary (or other) storage driver; local `UPLOAD_DIR` for now.
- Full Roles module (create/edit roles) and Staffing companies module; only read-only lookups here.
- Creating leave balances for a future FY when it opens (Leave module).
- Dropping `employees.office_id`.

## 7. Build order (one ticket = one commit; backend then UI per slice; second-company tests; ui-tester on UI tickets)
1. Schema changes (§3). 2. Head offices. 3. Projects + assign/remove. 4. Shifts + week-offs + copy.
5. Leave types/policies. 6. Salary components. 7. Approval groups. 8. Approval engine + inbox + emails.
9. Employee create wizard + drafts + login email + resend. 10. Employee list/detail/edit, main-project change,
bulk (de)activate. 11. Exit raise → approval → notice → LWD job → edit/cancel/confirm Immediate. 12. Rehire.

## 8. Senior review (2026-10-20)
25 problems found and resolved with the user; the decisions above already include them. Summary: first-employee
bootstrap (D18); owner as raiser/override actor (D27, §3); optional role + lookups (D48); exact field messages
(`docs/standards.md` §7.2); blocker fixes (16b → 18 → 17, 13b → 19, 31 → 28b); seed/data migration (§3); employee
sequence without FY (§3, D10); exit events (§3); `employees.office_id` deprecated; inactive group = field error
(D51); rehire codes, dates and kept fields (D67, D63); 0 notice days (D62); withdraw (D59); edit-terms past LWD
(D65); group edits while pending (D22a); GENERAL_EMPLOYEE edges (D48, D55); exited read-only + bulk all-or-nothing
(D56, D56a); staffing logins and self-resignation (D57, D66); future-FY leave balance (D34); LWD job scheduling (D63);
stat definitions (D6); project image (D11); split of tickets 14 and 16; minor wording (D19, D21, D29).
