# Schema review

Source: `hrms_schema/20261017000000-create-hrms-schema.js`. It's a raw-SQL snapshot of a live MySQL 8 database: 112 `CREATE TABLE` statements, generated 2026-10-17. The UI side comes from `hrms/src` (see `docs/ui-map.md`).
Reviewed 2026-10-19. **This is analysis only. Nothing in the schema or the code was changed.**

---

## 1. Summary

- There are **112 tables**, all InnoDB with utf8mb4 / `utf8mb4_0900_ai_ci`. Every PK is `int` or `bigint AUTO_INCREMENT`. **No table uses UUIDs.**
- **The tenant root is `employers`** (a company). Almost every table has an `employer_id` or `company_id` pointing to it. **The data model is multi-tenant.**
- **Identity:**
  - `users` is the login identity: email, phone, password.
  - `employers.user_id` links a company to its owning user (1:1).
  - `employees.user_id` links an employee record to a user.
  - `hrms_accounts` (user × company) holds the HRMS login and password setup, and `hrms_sessions` stores hashed tokens.
- **The schema mixes 3 generations of tables:**
  1. The current `hrms_*` tables, which most of the UI maps to.
  2. Legacy HRMS tables that duplicate them: `attendances`, `corrections`, `payroll_batches`/`payroll_records`, `leave_categories`, `shifts`, `roles`/`role_permissions`/`modules`/`role_employee`/`company_users`.
  3. Leftovers from a job-portal product: the `users.role` values JOB_SEEKER/EMPLOYER/UNIVERSITY/AGENT, `industry_types`, and `employers.is_company_verified`.

### Tables by domain (key columns → relationships)

| Domain | Tables | Key columns / relationships |
|---|---|---|
| Identity & tenant | `users`, `employers`, `industry_types`, `hrms_accounts`, `hrms_sessions` | `users.email`/`phone_number` unique, `users.role` enum (job-portal values); `employers.user_id` unique → users; `hrms_accounts(user_id, company_id)` unique, holds password_hash and setup token; `hrms_sessions.hrms_account_id` → hrms_accounts |
| RBAC (new) | `hrms_roles`, `hrms_permissions`, `hrms_role_permissions`, `hrms_user_role_assignments` | `hrms_roles(company_id, role_key)` with level; `permission_key` unique; assignments are scoped (`scope_type`/`scope_id`) and time-bounded |
| RBAC (legacy) | `roles`, `role_permissions`, `modules`, `role_employee`, `company_users` | roles × modules with CRUD flags; `employees.role_id` → roles; `employees.access_level` enum EMPLOYEE/SUB_ADMIN/ADMIN/GENERAL_EMPLOYEE |
| Org structure | `hrms_departments`, `hrms_designations`, `offices`, `office_locations`, `projects`, `cities1`, `cities`, `countries` | designations → departments; `projects.office_id` unique → offices and `offices.project_id` → projects (circular); `projects.city_id` → cities1; projects have lat/lng/radius_meters/allow_offline_attendance |
| Employees | `employees`, `employee_projects`, `hrms_employee_project_history`, `hrms_employee_drafts`, `hrms_employee_dependents`, `hrms_employee_documents`, `hrms_document_types`, `hrms_document_audit_logs` | `employees(company_id, country_emp_id)` unique; employees → user, shift, project, role, staffing company (department_id/designation_id have **no FK**); `employee_projects` is N:M with `main_project` and date ranges; documents → document_types |
| Shifts & holidays | `company_shifts`, `hrms_shift_time_history`, `hrms_shift_versions`, `hrms_employee_shift_history`, `shift_week_offs`, `shifts`, `hrms_holidays` | shifts are versioned by `effective_from` (2 near-identical tables); week-offs per shift per date; holidays by city with a generated `live_key` unique key |
| Attendance | `hrms_attendance`, `hrms_attendance_correction_requests`, `hrms_overtime_requests`, `attendances`, `corrections` | one row per check-in/out session, with geofence, ONLINE/OFFLINE source and `client_event_id`; corrections and overtime → approval requests; overtime has `batch_id` (bulk) and `project_id` |
| Approvals | `hrms_approval_groups`, `hrms_approval_group_members`, `hrms_approval_assignments`, `hrms_approval_requests`, `hrms_approval_request_logs`, `employee_approval_routing` | group (module_key, GLOBAL/PROJECT scope, total_levels) → members (level_no, mandatory, can_skip); assignments map module × project → group; requests are polymorphic (`entity_type`/`entity_id`) with current_level and logs per level |
| Leave | `hrms_leave_types`, `hrms_leave_policies`, `hrms_employee_leave_policies`, `hrms_leave_requests`, `hrms_leave_request_days`, `hrms_leave_attachments`, `hrms_leave_balances`, `hrms_leave_balance_transactions`, `hrms_leave_encashment_requests`, `hrms_leave_year_overrides`, `leave_categories` | type → policies (quota, accrual, carry forward, encashment, FY rules); employee ↔ policies; request → per-day rows (session, sandwich, holiday flags); balances per employee × type × year with a transaction ledger |
| Payroll | `hrms_salary_components`, `hrms_employee_salary`, `hrms_employee_salary_components`, `hrms_payroll_runs`, `hrms_payroll`, `hrms_payroll_items`, `hrms_salary_transactions`, `hrms_salary_increment_batches`, `hrms_salary_increment_lines`, `payroll_batches`, `payroll_records` | salary header (calc mode, currency, effective dates) + component lines (FIXED/PERCENTAGE); run (period, project, status) → payslip per employee → items (EARNING/DEDUCTION/INCENTIVE); ad-hoc transactions per period |
| Loans | `hrms_loans`, `hrms_loan_installments`, `hrms_loan_payments`, `hrms_loan_skip_requests`, `hrms_loan_ledger`, `hrms_loan_audit_log` | loan → EMI schedule (versioned) → payments; skip requests regenerate installments; double-entry ledger |
| Exits & visas | `hrms_employee_exits`, `hrms_exit_checklist_items`, `hrms_exit_checklist_templates`, `hrms_exit_documents`, `hrms_exit_events`, `hrms_exit_settings`, `hrms_exit_visas`, `hrms_exit_visa_trips` | exit (type, notice, LWD, settlement snapshot, rehire) → checklist, documents, events; visa (type, validity, max_exits) → trips |
| Staffing | `hrms_staffing_companies`, `hrms_staffing_company_projects`, `hrms_staffing_rates`, `hrms_staffing_bills`, `hrms_staffing_bill_items` | staffing company can log in (`user_id`, `login_enabled`); N:M with projects; bills per company × month → items per employee × project |
| Contracts | `hrms_contract_documents`, `hrms_contract_templates`, `hrms_contract_template_fields`, `hrms_contracts`, `hrms_contract_recipients`, `hrms_contract_fields`, `hrms_contract_activities`, `hrms_contract_types` | PDF document → template with positioned fields → contract → recipients (signing order) → filled fields and activity log; `hrms_contract_types` is isolated (no FK either way) |
| Collaboration | `project_invitations`, `project_participants`, `project_participant_edges`, `project_visibility_closure`, `project_participant_permissions`, `project_collaboration_roles`, `project_collaboration_role_permissions`, `project_employee_deployments` | companies invite companies onto a project (OWNER/CONSULTANT/EPC/SUBCONTRACTOR); tree via edges + closure table; per-module CRUD grants; partner employees deployed to projects |
| Financial year | `hrms_company_time_settings`, `hrms_financial_years`, `hrms_period_locks`, `hrms_year_close_steps`, `hrms_year_documents`, `hrms_year_events`, `hrms_number_sequences` | FY per employer (PLANNED/OPEN/CLOSING/CLOSED); month locks per module; year-end wizard steps; annual documents; numbering per FY |

---

## 2. Conflicts with `backend/CLAUDE.md` and project docs

These need a decision before any backend work starts (see Questions).

| # | Rule in our docs | What the schema has |
|---|---|---|
| C1 | IDs are `DataTypes.UUID` (CHAR(36)) | All PKs and FKs are int/bigint auto-increment. int vs bigint is mixed even between FK pairs: `hrms_departments.dept_head_id` is bigint but `employees.id` is int, `employee_approval_routing.approval_group_id` is int but `hrms_approval_groups.id` is bigint, and `hrms_approval_groups.created_by` is bigint but `users.id` is int. |
| C2 | Roles SUPER_ADMIN / HR / MANAGER / EMPLOYEE (root CLAUDE.md, `docs/test-users.md`) | None of these appear in the schema. `users.role` = ADMIN/JOB_SEEKER/EMPLOYER/HIRING_MANAGER/CONSULTANT/UNIVERSITY/AGENT; `employees.access_level` = EMPLOYEE/SUB_ADMIN/ADMIN/GENERAL_EMPLOYEE; `hrms_roles.role_key` is free text. The UI's own roles are ADMIN (owner) / EMPLOYEE / STAFFING_COMPANY. |
| C3 | One simple `User` model (scaffold prompt: name, email, password, role, status) | Identity is split across `users` (no name column), `employees.full_name`, `employers.contact_person_name` and `hrms_accounts.password_hash`, which duplicates `users.password`. |
| C4 | Collation `utf8mb4_unicode_ci` | `utf8mb4_0900_ai_ci` |
| C5 | Money as DECIMAL(12,2) | DECIMAL, never float, but precision varies: (15,2) for loans, (14,2) for payroll gross/net and bill totals, (12,2) elsewhere. `hrms_payroll.total_deductions` is (12,2) while gross and net in the same row are (14,2). `employees.overtime_rate` is (3,2), so the maximum is 9.99. |
| C6 | Store UTC (`timezone "+00:00"`) | `hrms_company_time_settings.timezone` defaults to `Asia/Riyadh`. That's fine as a display setting, but `date` columns (work_date, LWD) are local business dates. |
| C7 | DB changes only through migrations; never destructive | `down()` drops **all 112 tables** unconditionally, including `users`/`employers`/`projects`. The wrapping transaction gives no atomicity, because every MySQL DDL statement commits on its own. |
| C8 | List endpoints use `search` with `Op.like` | Fine. There's also a FULLTEXT index on `employers.company_name`. |
| C9 | Currency (app targets Saudi Arabia: Iqama, exit visas, Riyadh TZ, AR locale) | `hrms_employee_salary.currency` and `hrms_staffing_bills.currency` default to **'INR'**. Column length is vc(3) in one place and vc(10) in others. |

---

## 3. Schema quality issues (worth fixing whichever way we go)

- **Duplicate models for the same concept.** In each pair below, the current table is in **bold**:
  - `attendances` vs **`hrms_attendance`**
  - `corrections` vs **`hrms_attendance_correction_requests`**
  - `payroll_batches`/`payroll_records` vs **`hrms_payroll_runs`/`hrms_payroll`/`hrms_payroll_items`**
  - `leave_categories` vs **`hrms_leave_types`**
  - RBAC: legacy `roles`… vs **`hrms_roles`…**
  - `shifts` vs **`company_shifts`**
  - `hrms_shift_time_history` vs `hrms_shift_versions` (near-identical)
  - `cities` (has country) vs `cities1` (used by projects and holidays)
  - `employees.project_id` vs `employee_projects.main_project`
  - `hrms_employee_documents.document_type` (enum) vs `document_type_id` (FK)
  - `hrms_departments.dept_head_id` vs `dept_head`
- **Missing FKs.** About 60 FK-like columns have no constraint. Examples:
  - `employees.department_id` / `designation_id`
  - all of `employee_approval_routing`, `hrms_salary_transactions` and `hrms_document_audit_logs`
  - `hrms_employee_salary.employee_id`
  - employer_id/employee_id/reviewed_by in overtime and correction requests
  - most leave tables' employer_id / approved_by
- **Missing unique keys:**
  - `hrms_payroll_runs` per (employer, period, project)
  - `hrms_approval_groups.group_code`
  - `hrms_leave_requests.request_code`
  - `hrms_staffing_bills.bill_no`
  - `hrms_salary_components.code`
  - `hrms_contract_types.code`
  - `hrms_employee_leave_policies`
  - `hrms_approval_group_members`
  - `hrms_user_role_assignments`
  - `hrms_contract_recipients.access_token`
- **Unique keys that include a nullable column** don't prevent duplicates in MySQL: `hrms_approval_assignments.project_id`, `hrms_staffing_bill_items.project_id`, `hrms_roles.company_id`, `hrms_attendance.client_event_id`.
- **`projects.project_code` is unique globally**, not per employer.
- **Naming:**
  - `company_id` vs `employer_id` for the same thing.
  - `created_by` vs `created_by_user_id` vs `actor_user_id`.
  - Five spellings of a reject/cancel reason column.
  - `cities1`, `loc_id`, `country_emp_id`.
  - Soft delete done 3 ways: `is_deleted`, `deleted_at`, `is_active`.
- **Timestamps:**
  - Most `updated_at` columns have no `ON UPDATE`, so Sequelize must set them.
  - About 11 tables allow NULL `created_at`/`updated_at`.
  - `hrms_approval_assignments` timestamps are NOT NULL with no default.
- **Generated columns** must not be written by models: `hrms_holidays.city_key`/`live_key`, `hrms_leave_balances.live_key`, `hrms_staffing_bills.live_key`, `hrms_year_documents.employee_key`/`staffing_key`.
- **Security:** `users.access_jwt`/`refresh_jwt` are stored in plaintext columns (`hrms_sessions` correctly stores hashes). `hrms_contract_recipients.access_token` is plaintext.

---

## 4. UI ↔ schema mapping (per screen)

The UI paths and field lists are in `docs/ui-map.md`. Tables are listed in the order a screen needs them.

| Module / screens | Tables needed (key columns) |
|---|---|
| Login, Forgot/Verify OTP/Reset password | `users` (email, password), `hrms_accounts` (password_hash, status, last_login_at), `hrms_sessions` |
| Sign up | `users` (email, phone_number, password), `employers` (company_name, contact_person_name), `hrms_accounts` |
| Invite landing `/invitations/token/:token` | `project_invitations` (token, status, role_in_project, parent_employer_id), `employers`, `users` |
| Admin dashboard | aggregates over `employees`, `projects`, `hrms_approval_requests`, `hrms_payroll_runs`, `hrms_employee_documents.expiry_date`, `hrms_attendance` |
| Employees list / drafts | `employees` (country_emp_id, full_name, employment_type, employment_status, role_id, project_id, staffing_company_id), `users.email`, `roles.name`, `projects`, `hrms_staffing_companies`, `hrms_employee_drafts` (full_name, current_step, data, updated_at, updated_by_user_id) |
| Add employee wizard | `users`, `employees`, `employee_projects` (main_project), `hrms_employee_leave_policies`, `hrms_employee_salary` (currency, salary_calc_mode, working_hours, min_hours), `hrms_employee_salary_components` (calculation_type, amount), `hrms_employee_documents`, `hrms_departments`, `hrms_designations`, `company_shifts`, `countries` (nationality) |
| Employee detail tabs | `employees`, `hrms_employee_project_history`, `hrms_attendance`, `hrms_leave_requests`, `hrms_payroll` + `hrms_payroll_items`, `hrms_salary_increment_lines`, `hrms_employee_documents`, `hrms_employee_dependents`, `employee_approval_routing` (edit modal) |
| Departments / designations | `hrms_departments` (name, code, description, status, dept_head_id), `hrms_designations` |
| Exits, exit settings | `hrms_employee_exits`, `hrms_exit_checklist_items`, `hrms_exit_checklist_templates`, `hrms_exit_documents`, `hrms_exit_events`, `hrms_exit_settings`, `hrms_loans`, `hrms_leave_balances` |
| Invitations / collaboration | `project_invitations`, `project_participants`, `project_participant_edges`, `project_visibility_closure`, `project_collaboration_roles` + `_role_permissions`, `project_employee_deployments` |
| Attendance tracker / reports | `hrms_attendance` (work_date, check_in/out, project_id, source), `company_shifts`, `shift_week_offs`, `hrms_holidays`, `hrms_leave_request_days` |
| Overtime (admin, bulk, my) | `hrms_overtime_requests` (work_date, start/end_time, overtime_hours, batch_id, project_id, status), `hrms_approval_requests`/`_logs`, `employees.overtime_rate` |
| Correction requests | `hrms_attendance_correction_requests`, `hrms_approval_requests`/`_logs` |
| Payroll overview / run / preview / review | `hrms_payroll_runs`, `hrms_payroll`, `hrms_payroll_items`, `hrms_employee_salary(_components)`, `hrms_salary_transactions`, `hrms_attendance`, `hrms_overtime_requests` |
| Salary components | `hrms_salary_components` (name, type, description, is_active, is_system, code) |
| Transactions | `hrms_salary_transactions` (employee, project, period, type, is_advance, component, label, amount) |
| Salary report | `hrms_payroll` + items, `employees.country_emp_id`, `hrms_designations`, `hrms_employee_salary` |
| Payroll approvals | `hrms_payroll_runs`, `hrms_approval_requests`/`_logs` |
| Staffing billing (admin + portal) | `hrms_staffing_bills`, `hrms_staffing_bill_items`, `hrms_staffing_rates`, `hrms_staffing_companies` |
| Loans (approvals, detail, my loans) | `hrms_loans`, `hrms_loan_installments`, `hrms_loan_payments`, `hrms_loan_skip_requests`, `hrms_approval_requests` |
| Leave encashments | `hrms_leave_encashment_requests`, `hrms_leave_balances`, `hrms_leave_types` |
| Salary increments | `hrms_salary_increment_batches`, `hrms_salary_increment_lines`, `hrms_employee_salary` |
| Annual reports | `hrms_year_documents`, `hrms_financial_years` |
| Year-end wizard | `hrms_financial_years`, `hrms_year_close_steps`, `hrms_year_events`, `hrms_leave_year_overrides`, `hrms_leave_balances`, `hrms_period_locks`, `hrms_holidays`, `shift_week_offs` |
| Documents, document types, my documents | `hrms_employee_documents`, `hrms_document_types` (category, code, label, requires_*), `hrms_document_audit_logs` |
| Contracts (legacy) + contract types | `hrms_contracts`, `hrms_contract_recipients`, `hrms_contract_activities`, `hrms_contract_templates`, `hrms_contract_types` |
| Contract Studio | `hrms_contract_documents`, `hrms_contract_templates`, `hrms_contract_template_fields`, `hrms_contracts`, `hrms_contract_recipients`, `hrms_contract_fields`, `hrms_contract_activities` |
| Leave management, apply, policy, calendar, review, my leaves | `hrms_leave_types`, `hrms_leave_policies`, `hrms_employee_leave_policies`, `hrms_leave_requests`, `hrms_leave_request_days`, `hrms_leave_attachments`, `hrms_leave_balances`, `hrms_leave_balance_transactions`, `hrms_holidays`, approvals |
| Holidays | `hrms_holidays` (name, date, type, is_global, is_optional, is_half_day, from/to_time, is_active, source_holiday_id), `cities1` |
| Shifts | `company_shifts`, `hrms_shift_time_history` (or `hrms_shift_versions`), `shift_week_offs` |
| Projects (list, create, detail, assigned to me) | `projects`, `offices`, `cities1`, `employee_projects`, `hrms_staffing_company_projects`, `project_participants`, `project_employee_deployments` |
| Head offices | `offices` (office_name, email, phone, location, image) |
| Staffing companies (admin) | `hrms_staffing_companies`, `hrms_staffing_company_projects`, `employees.staffing_company_id`, `users` (portal login) |
| Approvals config, approval inbox | `hrms_approval_groups`, `hrms_approval_group_members`, `hrms_approval_assignments`, `hrms_approval_requests`, `hrms_approval_request_logs` |
| Visa management / approvals / my visa | `hrms_exit_visas`, `hrms_exit_visa_trips`, `hrms_employee_documents` |
| Settings | `employers` + `industry_types` (company profile), `hrms_accounts` + `users` (user management), `hrms_roles` + `hrms_permissions` (roles & permissions), `hrms_exit_settings`, `hrms_company_time_settings`, `hrms_financial_years`, `hrms_period_locks` |
| Profile | `employees` (dob, gender, nationality, address, profile_url), `users`, `hrms_accounts` (change password) |
| Header: notifications, year switcher, project filter | **no notifications table**; `hrms_financial_years`; `projects` |

---

## 5. Gap A: fields shown in the UI that are missing from the schema

| # | Screen | UI field / behaviour | Schema situation |
|---|---|---|---|
| A1 | Sign up, profile, user management | "Your Name" / "User Name" for the login user | `users` has **no name column**. The name exists only on `employees.full_name` or `employers.contact_person_name`. |
| A2 | Forgot password → Verify OTP | 6-digit OTP with resend timer | **No table or column for OTP codes** or reset tokens for regular users. `hrms_accounts.password_setup_token_hash` covers first-time setup only. |
| A3 | Header notifications panel (with approve/reject) | Notification list, read state | **No notifications table.** |
| A4 | Dashboard / employee detail "Recent Activity", employee dashboard "Announcements" | Activity feed, announcements | No generic activity or announcement table (only per-module logs). |
| A5 | Employees list | Both "Employee ID" **and** "Iqama No." columns | One column only: `employees.country_emp_id` vc(10). There's **no company employee code** column. |
| A6 | Add employee: salary step | "Hourly Rate", "Overtime Rate" | No hourly-rate column (it could be modelled as a component). `employees.overtime_rate` dec(3,2) only allows a multiplier ≤ 9.99. |
| A7 | Projects | Status **ON_HOLD** | `projects.status` enum is ACTIVE/INACTIVE/COMPLETED only. |
| A8 | Head offices | Status (Active/Inactive filter), map location (lat/lng), Total/Contract employee counts | `offices` has no `status` (only `is_deleted`) and no lat/lng; `office_location` is a varchar. Separate `office_locations` exists but isn't linked to `offices`. Employee counts would need `employees.loc_id`/office linkage, which isn't clear. |
| A9 | Payroll overview / run payroll | "Payroll Ref", custom **Start/End Date** of the run | `hrms_payroll_runs` has no reference code and no period start/end, only `period_month`/`period_year`. |
| A10 | Payroll preview, staffing billing, document review | Reject **reason** | No reject-reason column on `hrms_payroll_runs`, `hrms_staffing_bills` or `hrms_employee_documents`. This could live in `hrms_approval_request_logs.comments`, but document review doesn't use approvals. |
| A11 | Loan approvals | "Request changes" with **suggested amount and installments** | No columns for suggested amount or installments (only the `meta` json). |
| A12 | Leave policy | "Save as new version" | No version column. `policy_group_id` hints at versioning, but **there's no policy-group table**. |
| A13 | Attendance reports | "Approved By", "Remarks" per day | No such columns on `hrms_attendance`. |
| A14 | Contracts (legacy) | Contract **type** selection and filter | `hrms_contracts` has **no `contract_type_id`**, and `hrms_contract_types` is isolated. |
| A15 | Invoices pages (`/admin/invoices`, `InvoiceView`) | Invoice ID, line items, status **Overdue**, Mark as Paid | There's no invoice table. The closest is `hrms_staffing_bills`, whose statuses don't include OVERDUE. |
| A16 | Settings → Notification, Security & SSO, Billing & Subscriptions | Notification toggles, SSO config, subscription plan | Only `employers.email_notification`/`sms_notification` exist. **Nothing for SSO or subscriptions.** These tabs are static in the UI anyway. |
| A17 | Invite wizard: "invite by email" + register | Company invited by email before it exists | Covered by `project_invitations.invited_email`. OK. Listed only to confirm. |
| A18 | Employee documents | Review status shows `DRAFT/PENDING/APPROVED/REJECTED` **and** validity `VALID/EXPIRING SOON/EXPIRED` | Validity is derived from `expiry_date`. OK, but the "expiring soon" threshold (days) isn't stored anywhere. |
| A19 | Holidays | Filter by **financial year** | Derived from `holiday_date` + `hrms_financial_years`. OK. |

## 6. Gap B: tables in the schema that no screen uses

| Table(s) | Why unused / notes |
|---|---|
| `attendances`, `corrections` | Legacy versions of `hrms_attendance` / `hrms_attendance_correction_requests`. |
| `payroll_batches`, `payroll_records` | Legacy payroll. The UI matches `hrms_payroll_runs`/`hrms_payroll`/`hrms_payroll_items`. |
| `leave_categories` | Legacy version of `hrms_leave_types`. |
| `shifts` | Name-only and unreferenced. The UI uses `company_shifts`. |
| `cities` | The UI (projects, holidays) uses `cities1`. `countries` **is** used (nationality, calling codes). |
| `roles`, `role_permissions`, `modules`, `role_employee`, `company_users` | Legacy RBAC. The Settings → Roles & Permissions matrix could map to either system, so one must be chosen. `roles` is still referenced by `employees.role_id` ("Designated Role"). |
| `office_locations` | Geofences per company, not linked to offices or projects. Projects store their own lat/lng/radius. |
| `hrms_shift_versions` | Duplicate of `hrms_shift_time_history`. Keep one. |
| `hrms_document_audit_logs` | No audit-log screen. Backend-only logging. |
| `hrms_loan_ledger`, `hrms_loan_audit_log` | Backend-only (ledger and audit). No screen. |
| `hrms_number_sequences`, `hrms_sessions`, `hrms_permissions` | Backend infrastructure. Used indirectly, no screen. |
| `project_participant_edges`, `project_visibility_closure`, `project_participant_permissions` | Backend support for the collaboration hierarchy. Only indirectly visible. |
| `hrms_staffing_rates` | Only `AssignContractEmployees` ("Billing Rate") touches it, and that page is mostly static. |
| `users` columns `signup_by`, `provider`, `provider_id`, `fcm_token`, `last_seen_at`, `signup_step`; `employers.is_company_verified`, `verification_requested`; `industry_types` (only the Company Profile "Industry" dropdown) | Job-portal and mobile leftovers. There's no social login or push in the UI. |

---

## 7. Proposed module build order

Each module is one vertical slice: migration → model → service → routes → tests → wire UI.

1. **Auth & accounts.** Login, refresh, logout, forgot/OTP/reset password, sign up (company + owner), change password, role guard. Needs the roles/identity decision (Q1–Q3) first.
2. **Company setup.** Company profile, departments + designations, head offices, projects (+ cities), shifts + week-offs, holidays.
3. **RBAC & users.** Settings → user management, roles & permissions.
4. **Employees.** List, drafts, the add/edit wizard (salary structure, documents), detail, dependents, document types, documents.
5. **Approval engine.** Groups, members, assignments, requests and logs, approval inbox. Every request module below depends on it.
6. **Attendance.** Tracker and reports (read side), corrections, overtime (single and bulk).
7. **Leave.** Types/policies, employee policies, balances and ledger, apply/review/cancel, calendar, my leaves.
8. **Payroll.** Salary components, transactions, payroll runs → preview → approve → credit, payslips, salary report, increments.
9. **Loans & leave encashment.** Both feed payroll deductions and earnings.
10. **Staffing companies & billing.** Admin CRUD, staffing portal login, bills.
11. **Exits & exit visas.** Settlement uses leave, loans and payroll.
12. **Contracts.** Legacy contracts and types, then Contract Studio (templates, fields, signing).
13. **Collaboration.** Invitations, participants hierarchy, deployments.
14. **Financial year & year-end.** Settings, month locks, year-end wizard, annual reports.
15. **Dashboards & notifications.** Admin, employee and staffing dashboards, header notifications. Last, because they aggregate everything else.

---

## 8. Questions (business rules I can't infer)

**Foundations (they block Auth):**
1. **Roles.** Docs say SUPER_ADMIN/HR/MANAGER/EMPLOYEE. The UI is built for ADMIN (owner) / EMPLOYEE / STAFFING_COMPANY plus a per-permission matrix and access levels (EMPLOYEE/SUB_ADMIN/ADMIN/GENERAL_EMPLOYEE). Which model wins? Is STAFFING_COMPANY a login role? How do HR and MANAGER map onto the UI's screens and sidebars?
2. **Schema as source of truth?** Do we build Sequelize models on top of these existing 112 tables (int IDs, existing names)? Or do we design fresh, smaller migrations that follow `backend/CLAUDE.md` (UUIDs, `utf8mb4_unicode_ci`) and use this snapshot only as a reference? (`backend/CLAUDE.md` says UUID; this schema says int.)
3. **Multi-tenant?** Should one deployment serve many companies (`employers` as tenant, self-service sign-up), or just one company?
4. **Duplicates.** Can the legacy tables (section 6) and job-portal columns be dropped or ignored? Which RBAC system stays: `hrms_roles…` or `roles…`?

**Business rules:**

5. **Currency.** SAR everywhere, or per-employee currency? (The schema defaults to INR.)
6. **Employee identifiers.** Is "Employee ID" a separate company code from the Iqama/National ID number?
7. **Payroll.** Is there one run per month per project, or can periods be custom (UI Start/End date)? Who approves: an approval group, or a fixed role?
8. **Approvals.** Do leave, overtime, correction, loan, payroll, visa and encashment all go through approval groups? What happens when no group is configured: auto-approve, or block?
9. **Leave.** Is sandwich-leave counting on? Can the balance go negative per policy? How does "Save as new version" behave for employees already on the old policy?
10. **Head offices.** Do offices need geofence coordinates and an active/inactive status? What is the relationship between offices and projects? (The schema has a circular 1:1.)
11. **Invoices.** Are `/admin/invoices` pages the same thing as staffing bills, or a separate client-invoicing feature?
12. **MVP scope.** Are Contract Studio, collaboration/invitations, year-end, visas and annual reports in the first release, or later phases?
13. **Notifications.** Should there be in-app notifications (needs a table), e-mail only, or both?

**Tooling:**

14. `backend/.env.example` can't be read by the agent, because the deny rule `Read(**/.env.*)` also matches `.env.example`. Can the rule be narrowed so `.env.example` is readable?
