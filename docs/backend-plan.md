# Backend plan: scaffold, migrations, models, seeders

Status: **PROPOSAL, waiting for approval.** Nothing has been built yet.
Inputs: `hrms_schema/` (112 tables), `backend/CLAUDE.md`, `docs/schema-review.md`, and the user's answers on 2026-10-19 (section 1).

---

## 1. Decisions (user answers, 2026-10-19)

| # | Decision |
|---|---|
| D1 | **UUID everywhere.** Every PK and FK is `CHAR(36)` with `UUIDV4`. `hrms_schema` is the reference for columns and relationships only; types are normalised. |
| D2 | **Panels by access level.** `ADMIN` and `SUB_ADMIN` use the Admin panel. `EMPLOYEE` and `GENERAL_EMPLOYEE` use the Employee panel. `STAFFING_COMPANY` uses the Staffing-company panel. Partner companies (Consultant / EPC / Sub-contractor) are separate `employers` tenants with their own ADMIN, using the same Admin software. |
| D3 | **Permissions = roles.** Each company defines roles. Each role gets module × `can_read/can_create/can_update/can_delete`. A role is assigned to a login. **Departments and designations are only labels.** Kept: `roles`, `modules`, `role_permissions`. Dropped: `hrms_roles`, `hrms_permissions`, `hrms_role_permissions`, `hrms_user_role_assignments`, `role_employee`, `company_users`. |
| D4 | **Migrate everything except duplicates.** Each duplicate concept keeps exactly one table or column (section 3). |
| D5 | **Add the agreed UI gaps** (schema-review A1–A3, A5, A7–A10, A14). **Default currency is SAR.** Invoices, announcements, leave-policy versioning, attendance "approved by / remarks" and the loan "suggested amount" are left out until they're specified. |
| D6 | **Test users become panel roles:** `admin@hrms.test` (ADMIN, company owner), `subadmin@hrms.test` (SUB_ADMIN), `staffing@hrms.test` (STAFFING_COMPANY), `employee@hrms.test` (GENERAL_EMPLOYEE). All use password `Test@12345`. I'll update `docs/test-users.md` and the Roles line in `CLAUDE.md` to match. |

### Proposals that follow from D2 and D3 (P1, P2 and P3 confirmed by the user 2026-10-19)

- **P1. One place for a login's panel and role.** `hrms_accounts` (user × company) holds `access_level` (the 5 values from D2) and `role_id` → `roles`.
  - It replaces the job-portal `users.role` enum, `employees.access_level` and `employees.role_id`. Keeping those would be duplicates.
  - **ADMIN bypasses role checks** (full access). SUB_ADMIN, EMPLOYEE and GENERAL_EMPLOYEE are limited by their role.
  - STAFFING_COMPANY gets fixed access to its own panel.
- **P2. A single password per person** on `users.password` (bcrypt). `hrms_accounts.password_hash` and `temporary_password_hash` are dropped as duplicates. The invite/setup token columns stay on `hrms_accounts`.
- **P3. Money:** line amounts are `DECIMAL(12,2)` (per `backend/CLAUDE.md`). Aggregate totals that sum many lines are `DECIMAL(14,2)`: `payroll_runs.total_net`, `payroll.gross/net`, `staffing_bills.total_amount`, `increment_lines.*_gross`. Loan amounts are normalised from (15,2) to (12,2).

---

## 2. Global conventions (apply to every table)

- **Columns every table has, not repeated below:**
  - `id CHAR(36) PK DEFAULT UUIDV4`
  - `created_at DATETIME NN`
  - `updated_at DATETIME NN`
- **Markers used in section 4:**
  - **[P]** = paranoid: the table also gets `deleted_at DATETIME` for soft delete.
  - **[L]** = append-only log: no `updated_at`.
- **Soft delete is done one way only: `deleted_at`.** I'm removing `is_deleted` everywhere. `is_active` stays only where it's a real business flag.
- **Tenant column is always `employer_id`.** Every `company_id` gets renamed.
- **"Who did it" columns** (`created_by`, `updated_by`, `approved_by`, `reviewed_by`, `actioned_by`, …) all point to `users.id`, with ON DELETE SET NULL.
- **One reject-reason column name: `reject_reason`.** `rejection_reason`, `declined_reason`, `cancel_reason` and `cancellation_reason` become `reject_reason`, or `cancel_reason` when it's a cancellation.
- **Types:**
  - Dates without a time are `DATEONLY`. Timestamps are `DATE` (DATETIME, stored in UTC).
  - Period columns are `period_month TINYINT` and `period_year SMALLINT`.
  - Currency is `CHAR(3) DEFAULT 'SAR'`.
- **Foreign keys:** every `*_id` column gets a real FK and an index. ON DELETE is CASCADE for children of the tenant or parent, and SET NULL for optional references.
- **Indexes:** every FK, plus filter and search columns (status, dates, email, `employee_code`, names).
- **Polymorphic references** (`entity_type` + `entity_id`, `reference_type` + `reference_id`) stay without an FK and get a composite index.
- **Charset:** `utf8mb4` / `utf8mb4_unicode_ci`. The Sequelize timezone is `+00:00`.
- **Generated "live_key" columns** keep their partial-unique behaviour. They're added with raw `ALTER TABLE` in the same migration. Models declare them read-only (never written).
- **Naming:** models use `underscored: true`. Model names are PascalCase singular (`LeaveRequest`); table names stay as in the schema.

**Type shorthand used below:** `uuid`, `str(n)` = VARCHAR(n), `text`, `int`, `dec(p,s)`, `date` = DATEONLY, `dt` = DATETIME, `time`, `bool`, `json`, `enum(...)`. **NN** = NOT NULL, `=x` = default, `→t` = FK to `t.id`, **U(...)** = unique key.

---

## 3. Duplicates removed

| Concept | Kept | Removed |
|---|---|---|
| Attendance | `hrms_attendance` | `attendances` |
| Corrections | `hrms_attendance_correction_requests` | `corrections` |
| Payroll | `hrms_payroll_runs`, `hrms_payroll`, `hrms_payroll_items` | `payroll_batches`, `payroll_records` |
| Leave types | `hrms_leave_types` | `leave_categories` |
| Shifts | `company_shifts` + `hrms_shift_time_history` | `shifts`, `hrms_shift_versions` |
| Cities | `cities` (has `country_id`) + `countries` | `cities1` (projects and holidays now point to `cities`) |
| Permissions | `roles`, `modules`, `role_permissions` | `hrms_roles`, `hrms_permissions`, `hrms_role_permissions`, `hrms_user_role_assignments`, `role_employee`, `company_users` |
| Geofence | `projects.lat/lng/radius_meters`, new `offices.lat/lng` | `office_locations` (`employees.loc_id` becomes `employees.office_id`) |
| Login role / password | `hrms_accounts.access_level` + `role_id`, `users.password` | `users.role`, `employees.access_level`, `employees.role_id`, `hrms_accounts.password_hash` / `temporary_password_hash`, `users.access_jwt` / `refresh_jwt` (sessions keep hashes) |
| Main project | `employee_projects.main_project` | `employees.project_id` |
| Office ↔ project | `projects.office_id` | `offices.project_id` (removes the circular 1:1) |
| Document type | `hrms_employee_documents.document_type_id` | `document_type` enum |
| Department head | `hrms_departments.dept_head_id` | `dept_head` |
| Deleted flags | `deleted_at` | `is_deleted` (employees, offices, projects, employee documents) |
| Leave balance uniqueness | `U(employee_id, leave_type_id, balance_year, live_key)` | the overlapping second unique key |

**Result: 112 tables − 15 removed + 2 added (`password_reset_otps`, `notifications`) = 99 tables.**

---

## 4. Tables, in migration (dependency) order

### Group 0: lookups and identity

1. **countries**:
   - Columns: `name str(150) NN`, `calling_code str(10)`, `iso2 char(2)`.
   - Indexes: U(iso2).
2. **cities**:
   - Columns: `country_id →countries` (SET NULL), `city_name str(150) NN`, `city_code str(50)`, `is_active bool =1`.
   - Indexes: idx(country_id), idx(city_name).
3. **industry_types** [P]:
   - Columns: `industry_name str(255) NN`, `industry_image str(255)`.
4. **modules**:
   - Columns: `module_key str(100) NN`, `name str(150) NN`, `sort_order int =0`.
   - Indexes: U(module_key).
   - Seeded from the UI `MODULES` list.
5. **users** [P]:
   - Columns:
     - `name str(150)` (**new, A1**)
     - `email str(255) NN`, `phone_number str(30)`, `password str(255)` (bcrypt)
     - `user_status enum(ACTIVE,INACTIVE,BLOCKED,SUSPENDED) =ACTIVE`
     - `is_email_verified bool =0`, `is_number_verified bool =0`
     - `signup_by enum(EMAIL,PHONE,GOOGLE,APPLE)`, `provider enum(same)`, `provider_id str(255)`
     - `signup_step int =1`, `lang_key enum(EN,AR) =EN`, `fcm_token text`, `last_seen_at dt`
   - Indexes: U(email), U(phone_number).
6. **password_reset_otps** (**new, A2**):
   - Columns: `user_id →users NN` (CASCADE), `otp_hash str(128) NN`, `expires_at dt NN`, `attempts int =0`, `consumed_at dt`.
   - Indexes: idx(user_id, expires_at).

### Group 1: tenant

7. **employers** [P]:
   - Columns:
     - `user_id →users NN` (owner), `industry_type_id →industry_types` (SET NULL)
     - `company_name str(255) NN`, `company_logo text`, `contact_person_name str(255)`, `company_email str(255)`, `company_phone_number str(30)`, `company_website str(255)`, `company_description text`, `address text`
     - `is_company_verified bool =0`, `verification_requested bool =0`
     - `employer_status enum(ACTIVE,INACTIVE,BANNED) =ACTIVE`
     - `email_notification bool =1`, `sms_notification bool =0`
   - Indexes: U(user_id), FULLTEXT(company_name).
8. **hrms_company_time_settings**:
   - Columns:
     - `employer_id →employers NN`
     - `timezone str(64) ='Asia/Riyadh'`, `fy_start_month tinyint =1`, `review_days_before int =30`, `auto_open_next_year bool =1`, `reopen_window_days int =7`
     - `lock_mode enum(YEARLY,MONTHLY) =YEARLY`, `pending_on_close enum(BLOCK,CANCEL,CARRY) =BLOCK`, `offline_backdate_days int =3`
   - Indexes: U(employer_id).
9. **hrms_financial_years**:
   - Columns:
     - `employer_id NN`, `year_key smallint NN`, `label str(20) NN`, `start_date date NN`, `end_date date NN`
     - `status enum(PLANNED,OPEN,CLOSING,CLOSED) =PLANNED`, `is_locked bool =0`
     - `opened_at`, `closing_started_at`, `closed_at dt`, `closed_by →users`, `reopened_at dt`, `reopened_by →users`, `reopen_until dt`, `totals json`
   - Indexes: U(employer_id, year_key), idx(employer_id, status).
10. **hrms_number_sequences**:
    - Columns: `employer_id NN`, `doc_type enum(STAFFING_BILL,LOAN,CONTRACT,PAYROLL_RUN)` (**+PAYROLL_RUN** for A9), `financial_year_id →hrms_financial_years NN`, `last_no int =0`.
    - Indexes: U(employer_id, doc_type, financial_year_id).
11. **hrms_period_locks**:
    - Columns: `employer_id NN`, `financial_year_id NN`, `period_year`, `period_month NN`, `module enum(ALL,ATTENDANCE,LEAVE,PAYROLL,BILLING) =ALL`, `locked_at dt NN`, `locked_by →users`, `reason str(500)`.
    - Indexes: U(employer_id, period_year, period_month, module).
12. **roles** [P]:
    - Columns: `employer_id NN`, `name str(100) NN`, `description str(255)`, `is_system bool =0` (system roles can't be deleted).
    - Indexes: U(employer_id, name).
13. **role_permissions**:
    - Columns: `role_id →roles NN` (CASCADE), `module_id →modules NN` (CASCADE), `can_read`, `can_create`, `can_update`, `can_delete bool =0`.
    - Indexes: U(role_id, module_id).
14. **hrms_accounts** [P]:
    - Columns:
      - `user_id →users NN`, `employer_id NN`
      - `access_level enum(ADMIN,SUB_ADMIN,EMPLOYEE,GENERAL_EMPLOYEE,STAFFING_COMPANY) NN` (**D2/P1**), `role_id →roles` (SET NULL) (**P1**)
      - `status enum(ACTIVE,INACTIVE,SUSPENDED) =ACTIVE`, `last_login_at dt`
      - `password_setup_required bool =1`, `password_set_at dt`, `password_setup_token_hash str(128)`, `password_setup_token_expires_at dt`
      - `invited_by →users`, `invited_at dt`, `created_by`, `updated_by →users`
    - Indexes: U(user_id, employer_id), idx(employer_id, access_level), idx(password_setup_token_hash).
15. **hrms_sessions**:
    - Columns: `hrms_account_id →hrms_accounts NN` (CASCADE), `access_token_hash str(128) NN`, `refresh_token_hash str(128) NN`, `status enum(ACTIVE,REVOKED,EXPIRED) =ACTIVE`, `user_agent text`, `ip_address str(80)`, `expires_at dt NN`, `revoked_at dt`.
    - Indexes: U(access_token_hash), U(refresh_token_hash).
16. **notifications** (**new, A3**):
    - Columns: `employer_id NN`, `user_id →users NN` (CASCADE), `type str(60) NN`, `title str(200) NN`, `body text`, `entity_type str(100)`, `entity_id char(36)`, `read_at dt`.
    - Indexes: idx(user_id, read_at), idx(entity_type, entity_id).

### Group 2: org setup

17. **hrms_departments** [P]:
    - Columns: `employer_id NN`, `name str(150) NN`, `code str(50)`, `description text`, `status enum(ACTIVE,INACTIVE) =ACTIVE`, `dept_head_id` (FK added in step 31, after employees), `created_by`, `updated_by →users`.
    - Indexes: U(employer_id, name), idx(status).
18. **hrms_designations** [P]:
    - Columns: `employer_id NN`, `department_id →hrms_departments NN`, `name str(150) NN`, `code str(50)`, `description text`, `status enum(ACTIVE,INACTIVE) =ACTIVE`, `created_by`, `updated_by`.
    - Indexes: U(employer_id, department_id, name).
19. **offices** [P]:
    - Columns: `employer_id NN`, `office_name str(255) NN`, `office_email str(255)`, `office_phone str(30)`, `office_location str(255)`, `lat dec(10,7)`, `lng dec(10,7)` (**new, A8**), `status enum(ACTIVE,INACTIVE) =ACTIVE` (**new, A8**), `office_image str(500)`.
    - Indexes: idx(employer_id, status), idx(office_name).
20. **projects** [P]:
    - Columns:
      - `employer_id NN`, `office_id →offices` (SET NULL), `city_id →cities` (SET NULL)
      - `project_name str(255) NN`, `project_code str(100) NN`, `description text`, `project_location str(255)`
      - `start_date date`, `end_date date`
      - `status enum(ACTIVE,INACTIVE,COMPLETED,ON_HOLD) =ACTIVE` (**+ON_HOLD, A7**)
      - `lat`, `lng dec(10,7)`, `radius_meters int =100`, `allow_offline_attendance bool =1`, `photo_url str(255)`
    - Indexes: **U(employer_id, project_code)** (per-tenant, was global), idx(status), idx(project_name).
21. **company_shifts** [P]:
    - Columns: `employer_id NN`, `name str(50) NN ='GENERAL'`, `start_time time NN`, `end_time time NN`.
    - Indexes: U(employer_id, name).
22. **hrms_shift_time_history**:
    - Columns: `shift_id →company_shifts NN` (CASCADE), `employer_id NN`, `start_time`, `end_time time NN`, `effective_from date NN`, `created_by →users`.
    - Indexes: U(shift_id, effective_from).
23. **shift_week_offs**:
    - Columns: `shift_id →company_shifts NN` (CASCADE), `employer_id NN`, `off_date date NN`.
    - Indexes: U(shift_id, off_date), idx(employer_id, off_date).
24. **hrms_holidays** [P]:
    - Columns:
      - `employer_id NN`, `city_id →cities` (SET NULL), `holiday_name str(200) NN`, `holiday_date date NN`
      - `holiday_type enum(PUBLIC,FESTIVAL,NATIONAL,COMPANY,OPTIONAL,WEEKLY_OFF) =PUBLIC`
      - `is_global bool =0`, `is_optional bool =0`, `is_half_day bool =0`, `from_time`, `to_time time`, `description text`, `is_active bool =1`
      - `source_holiday_id →hrms_holidays` (SET NULL)
      - generated `city_key`, `live_key`
    - Indexes: U(employer_id, holiday_date, city_key, live_key).
25. **hrms_staffing_companies** [P]:
    - Columns:
      - `employer_id NN`, `user_id →users` (portal login, SET NULL)
      - `name str(255) NN`, `code str(100)`, `email str(255)`, `phone str(30)`
      - `contact_person_name str(255)`, `contact_person_email str(255)`, `contact_person_phone str(30)`
      - `city str(100)`, `address text`, `status enum(ACTIVE,INACTIVE) =ACTIVE`
      - `login_enabled bool =1`, `must_change_password bool =1`
      - `signature_url str(512)`, `signature_type enum(DRAWN,TYPED,UPLOADED)`, `signature_updated_at dt`, `company_image str(500)`
      - `created_by`, `updated_by`
    - Indexes: U(employer_id, code), idx(employer_id, status), idx(name).
26. **hrms_staffing_company_projects**:
    - Columns: `employer_id NN`, `staffing_company_id NN`, `project_id NN`, `is_active bool =1`.
    - Indexes: U(staffing_company_id, project_id).
27. **hrms_document_types**:
    - Columns: `employer_id NN`, `category enum(LEGAL,IDENTITY,PROFESSIONAL,SITE,CONTRACT,GENERAL) NN`, `code str(100) NN`, `label str(150) NN`, `description str(255)`, `requires_number`, `requires_expiry`, `requires_issuer bool =0`, `is_system bool =0`, `is_active bool =1`.
    - Indexes: U(employer_id, code).
28. **hrms_salary_components**:
    - Columns: `employer_id NN`, `name str(100) NN`, `code str(50)`, `type enum(EARNING,DEDUCTION) NN`, `description str(255)`, `is_system bool =0`, `is_active bool =1`.
    - Indexes: U(employer_id, name), U(employer_id, code).
29. **hrms_leave_types**:
    - Columns: `employer_id NN`, `leave_name str(150) NN`, `leave_code str(100) NN`, `description text`, `is_paid bool =1`, `allow_half_day bool =1`, `requires_document bool =0`, `is_active bool =1`.
    - Indexes: U(employer_id, leave_code), U(employer_id, leave_name).
30. **hrms_leave_policies** [P]:
    - Columns:
      - `employer_id NN`, `leave_type_id →hrms_leave_types NN`, `policy_name str(150) NN`
      - `yearly_quota`, `monthly_accrual dec(6,2) =0`
      - `accrual_frequency enum(MONTHLY,QUARTERLY,HALF_YEARLY,YEARLY) =MONTHLY`, `accrual_day int`
      - `allow_carry_forward bool =0`, `max_carry_forward_days dec(6,2) =0`, `allow_negative_balance bool =0`
      - `allow_encashment bool =0`, `max_encashment_days dec(6,2) =0`
      - `effective_from`, `effective_to date`, `is_active bool =1`
      - `carry_forward_expiry_months int =0`, `year_end_excess enum(LAPSE,ENCASH) =LAPSE`
      - `accrual_method enum(MONTHLY_ACCRUAL,UPFRONT) =MONTHLY_ACCRUAL`, `prorate_joiners bool =1`
    - Dropped: `policy_group_id`, which has no table (versioning is deferred, D5).

### Group 3: employees

31. **employees** [P]:
    - Columns:
      - `user_id →users NN`, `employer_id NN`
      - `employee_code str(30) NN` (**new, A5**), `country_emp_id str(20) NN` (Iqama / National ID / passport)
      - `full_name str(255) NN`, `nationality str(100)`, `dob date`, `gender enum(MALE,FEMALE,OTHER)`, `address text`, `accommodation str(255)`, `profile_url text`
      - `employment_type enum(FULL_TIME,CONTRACT)`, `employment_status enum(ACTIVE,IN_NOTICE,EXITED) =ACTIVE`, `date_of_joining date`, `exit_date date`
      - `department_id →hrms_departments`, `designation_id →hrms_designations`, `shift_id →company_shifts`, `office_id →offices`, `staffing_company_id →hrms_staffing_companies` (all SET NULL)
      - `overtime_rate dec(5,2) =1.50`, `is_billable bool =0`
      - `signature_url`, `signature_type`, `signature_updated_at`
    - Indexes: U(employer_id, employee_code), U(employer_id, country_emp_id), idx(employer_id, employment_status), idx(full_name), idx(employment_type).
    - **The same migration then adds the FK `hrms_departments.dept_head_id → employees` (SET NULL).**
32. **employee_projects**:
    - Columns: `employer_id NN`, `employee_id NN`, `project_id NN`, `is_active bool =1`, `start_date`, `end_date date`, `main_project bool =0`, `main_project_date_start`, `main_project_date_end date`.
    - Indexes: U(employee_id, project_id), idx(employee_id, is_active).
33. **hrms_employee_project_history** [L]:
    - Columns: `employer_id NN`, `employee_id NN`, `project_id NN`, `previous_project_id →projects`, `action enum(ASSIGNED,REMOVED,MOVED_IN,MOVED_OUT) NN`, `actioned_by →users`, `notes text`, `actioned_at dt NN`.
34. **hrms_employee_shift_history**:
    - Columns: `employee_id NN`, `shift_id NN`, `effective_from date NN`.
    - Indexes: U(employee_id, effective_from).
35. **hrms_employee_drafts** [P]:
    - Columns: `employer_id NN`, `full_name str(255)`, `email str(255)`, `current_step tinyint =1`, `data json NN`, `created_by`, `updated_by →users`.
    - Indexes: idx(employer_id, updated_at).
36. **hrms_employee_dependents** [P]:
    - Columns:
      - `employee_id NN`, `full_name str(255) NN`, `relationship enum(SPOUSE,CHILD,PARENT,OTHER) NN`
      - `id_details str(255)`, `date_of_birth date`, `gender enum`, `nationality str(100)`, `contact str(30)`
      - `photo_url text`, `document_url text`, `document_name str(255)`
      - `status enum(PENDING,VERIFIED,REJECTED) =PENDING`, `reviewed_by →users`, `reviewed_at dt`, `reject_reason text`
37. **hrms_employee_documents** [P]:
    - Columns:
      - `employer_id NN`, `employee_id NN`, `document_type_id →hrms_document_types NN`
      - `document_number str(100)`, `issuing_authority str(150)`, `issue_date`, `expiry_date date`
      - `file_url text`, `file_name str(255)`, `file_type str(100)`
      - `status enum(DRAFT,PENDING,APPROVED,REJECTED) =PENDING`, `reject_reason text` (**new, A10**)
      - `is_active bool =1` (current version), `meta json`, `uploaded_by →users`
    - Indexes: idx(employee_id, is_active), idx(status), idx(expiry_date).
38. **hrms_document_audit_logs** [L]:
    - Columns: `employer_id NN`, `document_id →hrms_employee_documents NN` (CASCADE), `employee_id →employees`, `action enum(UPLOAD,VIEW,DOWNLOAD,UPDATE,DELETE,RESTORE,CONTRACT_APPROVE,CONTRACT_REJECT) NN`, `actor_user_id →users`, `note text`, `ip str(64)`, `meta json`.
39. **hrms_employee_salary**:
    - Columns: `employee_id NN`, `employer_id NN`, `currency char(3) ='SAR'`, `salary_calc_mode enum(MONTHLY_FIXED,MONTHLY_HOURLY,HOURLY) =MONTHLY_FIXED`, `working_hours`, `min_hours dec(6,2)`, `effective_from date NN`, `effective_to date`, `is_active bool =1`.
    - Indexes: idx(employee_id, is_active).
40. **hrms_employee_salary_components**:
    - Columns: `employee_salary_id NN` (CASCADE), `salary_component_id NN` (RESTRICT), `calculation_type enum(FIXED,PERCENTAGE) =FIXED`, `amount dec(12,2) NN`, `percent_base json`.
    - Indexes: U(employee_salary_id, salary_component_id).
41. **hrms_employee_leave_policies**:
    - Columns: `employer_id NN`, `employee_id NN`, `leave_policy_id NN`, `effective_from`, `effective_to date`, `is_active bool =1`.
    - Indexes: U(employee_id, leave_policy_id, effective_from).

### Group 4: approvals

42. **hrms_approval_groups** [P]:
    - Columns: `employer_id NN`, `group_name str(150) NN`, `group_code str(100) NN`, `module_key str(100) NN`, `scope enum(GLOBAL,PROJECT) =GLOBAL`, `project_id →projects`, `description text`, `total_levels int =1`, `is_active bool =1`, `created_by →users`.
    - Indexes: U(employer_id, group_code), idx(employer_id, module_key).
43. **hrms_approval_group_members**:
    - Columns: `approval_group_id NN` (CASCADE), `employee_id NN`, `level_no int NN`, `is_mandatory bool =1`, `can_skip bool =0`, `is_active bool =1`.
    - Indexes: U(approval_group_id, employee_id, level_no).
44. **hrms_approval_assignments**:
    - Columns: `employer_id NN`, `module_key str(100) NN`, `approval_group_id` (SET NULL), `project_id →projects` (CASCADE), `is_active bool =1`.
    - Indexes: idx(employer_id, module_key, project_id). The partial-unique via generated `project_key` works the same way as the holidays table.
45. **employee_approval_routing**:
    - Columns: `employer_id NN`, `employee_id NN`, `module_key str(40) NN`, `approval_group_id NN`.
    - Indexes: U(employee_id, module_key).
    - FKs: all added (the schema had none).
46. **hrms_approval_requests** [P]:
    - Columns: `employer_id NN`, `approval_group_id NN`, `module_key str(100) NN`, `entity_type str(100) NN`, `entity_id char(36) NN`, `request_code str(100) NN`, `requested_by →employees NN`, `current_level`, `total_levels int =1`, `final_status enum(PENDING,IN_PROGRESS,APPROVED,REJECTED,CANCELLED) =PENDING`, `remarks text`, `requested_at dt NN`, `completed_at dt`.
    - Indexes: U(employer_id, request_code), idx(entity_type, entity_id), idx(final_status).
47. **hrms_approval_request_logs** [L]:
    - Columns: `approval_request_id NN` (CASCADE), `approval_group_member_id NN` (CASCADE), `employee_id NN`, `level_no int NN`, `status enum(PENDING,APPROVED,REJECTED,SKIPPED) =PENDING`, `comments text`, `acted_at dt`.

### Group 5: attendance

48. **hrms_attendance**:
    - Columns: `employer_id NN`, `employee_id NN`, `project_id NN`, `work_date date NN`, `check_in_time dt NN`, `check_in_lat`, `check_in_lng dec(10,7) NN`, `check_in_photo text`, `check_out_time dt`, `check_out_lat`, `check_out_lng dec(10,7)`, `is_within_geofence bool =0`, `source enum(ONLINE,OFFLINE) =ONLINE`, `client_event_id str(100)`, `synced_at dt`.
    - Indexes: idx(employee_id, work_date), idx(project_id, work_date), U(employee_id, client_event_id).
49. **hrms_attendance_correction_requests**:
    - Columns: `employer_id NN`, `employee_id NN`, `attendance_id →hrms_attendance` (SET NULL), `work_date date NN`, `correction_type enum(ADD_CHECK_IN,ADD_CHECK_OUT,UPDATE_TIMES,MARK_PRESENT) NN`, `requested_check_in`, `requested_check_out dt`, `reason text`, `attachment_url text`, `status enum(PENDING,APPROVED,REJECTED) =PENDING`, `approval_request_id` (SET NULL), `reviewed_by →users`, `reviewed_at dt`, `reject_reason text`.
    - Indexes: idx(employer_id, employee_id, work_date), idx(status).
50. **hrms_overtime_requests**:
    - Columns: `employer_id NN`, `employee_id NN`, `project_id →projects`, `work_date date NN`, `start_time`, `end_time time`, `overtime_hours dec(6,2) NN`, `reason text`, `attachment_url text`, `batch_id str(40)`, `status enum(PENDING,APPROVED,REJECTED) =PENDING`, `approval_request_id`, `reviewed_by`, `reviewed_at`, `reject_reason`.
    - Indexes: idx(employer_id, employee_id, work_date), idx(batch_id), idx(status).

### Group 6: leave

51. **hrms_leave_balances** [P]:
    - Columns:
      - `employer_id NN`, `employee_id NN`, `leave_type_id NN`, `leave_policy_id`, `financial_year_id`
      - `balance_year smallint NN`
      - `opening_balance`, `accrued_balance`, `carry_forward_balance`, `adjusted_balance`, `consumed_balance`, `encashed_balance`, `expired_balance`, `total_allocated`, `available_balance`: all `dec(6,2) =0`
      - `last_accrual_date`, `last_encashment_date date`
      - `status enum(OPEN,CLOSED) =OPEN`, `carry_forward_expires_on date`, `carry_forward_used dec(6,2) =0`
      - generated `live_key`
    - Indexes: U(employee_id, leave_type_id, balance_year, live_key).
52. **hrms_leave_requests** [P]:
    - Columns:
      - `employer_id NN`, `employee_id NN`, `project_id`, `leave_type_id NN`, `leave_policy_id`, `approval_request_id`
      - `request_code str(100) NN`, `from_date`, `to_date date NN`
      - `total_days`, `paid_days`, `unpaid_days dec(6,2)`, `reason text`
      - `status enum(PENDING,APPROVED,REJECTED,CANCELLED,PARTIALLY_APPROVED) =PENDING`, `applied_at dt NN`
      - `approved_by`, `rejected_by →users`, `approved_at`, `rejected_at dt`, `reject_reason text`
      - `cancelled_at dt`, `cancel_reason text`
    - Indexes: U(employer_id, request_code), idx(employee_id, from_date), idx(status).
53. **hrms_leave_request_days** [L]:
    - Columns: `employer_id NN`, `leave_request_id NN` (CASCADE), `employee_id NN`, `leave_date date NN`, `session_type enum(FULL_DAY,FIRST_HALF,SECOND_HALF) =FULL_DAY`, `leave_value dec(3,1) =1.0`, `is_weekly_off`, `is_holiday bool =0`, `holiday_id →hrms_holidays`, `holiday_name str(200)`, `is_sandwich_leave bool =0`, `is_paid`, `is_counted bool =1`, `leave_year smallint`.
    - Indexes: idx(employee_id, leave_date).
54. **hrms_leave_attachments** [L]:
    - Columns: `employer_id NN`, `leave_request_id NN` (CASCADE), `file_name str(255)`, `file_url text`, `file_type str(100)`, `uploaded_by →users`.
55. **hrms_leave_balance_transactions** [L]:
    - Columns: `employer_id NN`, `employee_id NN`, `leave_balance_id NN` (CASCADE), `leave_type_id NN`, `transaction_type enum(CREDIT,DEBIT,ADJUSTMENT,REVERSAL,CARRY_FORWARD,ACCRUAL,ENCASHMENT,EXPIRY) NN`, `leave_source enum(MANUAL,SYSTEM,LEAVE_REQUEST,ACCRUAL,ENCASHMENT,CARRY_FORWARD,EXPIRY) =SYSTEM`, `transaction_date date NN`, `days dec(6,2) NN`, `balance_before`, `balance_after dec(6,2)`, `reference_type str(100)`, `reference_id char(36)`, `reference_code str(100)`, `remarks text`, `leave_year smallint`, `created_by →users`.
    - Indexes: idx(reference_type, reference_id).
56. **hrms_leave_year_overrides**:
    - Columns: `financial_year_id NN`, `leave_balance_id NN`, `carry_days`, `encash_days dec(6,2) =0`, `reason str(500) NN`, `created_by`.
    - Indexes: U(financial_year_id, leave_balance_id).

### Group 7: payroll

57. **hrms_salary_transactions** [P]:
    - Columns: `employer_id NN`, `employee_id NN`, `project_id`, `period_year`, `period_month NN`, `type enum(EARNING,DEDUCTION) NN`, `is_advance bool =0`, `salary_component_id`, `label str(150) NN`, `amount dec(12,2) NN`, `created_by`.
    - Indexes: idx(employer_id, employee_id, period_year, period_month).
58. **hrms_leave_encashment_requests**:
    - Columns:
      - `employer_id NN`, `employee_id NN`, `leave_type_id NN`, `leave_balance_id`, `financial_year_id`
      - `days dec(6,2) NN`, `payout_year`, `payout_month NN`
      - `daily_rate dec(12,2) =0`, `amount_estimated dec(12,2) =0`, `amount_final dec(12,2)`, `currency char(3) ='SAR'`
      - `status enum(PENDING,APPROVED,REJECTED,CANCELLED,PAID) =PENDING`, `reason str(500)`, `reject_reason str(500)`
      - `approval_request_id`, `salary_transaction_id →hrms_salary_transactions`, `balance_transaction_id →hrms_leave_balance_transactions`
      - `requested_by →users`, `raised_on_behalf bool =0`, `approved_by →users`, `approved_at`, `cancelled_at dt`
    - FKs: all added.
59. **hrms_payroll_runs** [P]:
    - Columns: `employer_id NN`, `project_id`, `reference_no str(30) NN` (**new, A9**), `period_month`, `period_year NN`, `period_start`, `period_end date NN` (**new, A9**), `status enum(DRAFT,PENDING_APPROVAL,APPROVED,REJECTED,PAID,CREDITED) =DRAFT`, `reject_reason text` (**new, A10**), `approval_request_id`, `total_net dec(14,2) =0`, `generated_by →users`, `generated_at dt`.
    - Indexes: U(employer_id, reference_no), idx(employer_id, period_year, period_month), idx(status).
60. **hrms_payroll** [P] (one payslip per employee per run):
    - Columns:
      - `run_id NN` (CASCADE), `employer_id NN`, `employee_id NN`
      - `gross_salary dec(14,2)`, `total_deductions dec(14,2)`, `net_salary dec(14,2)`
      - `total_working_days`, `total_present_days`, `absent_days dec(5,2)`, `leave_days`, `unpaid_leave_count dec(5,2)`
      - `total_worked_hours`, `worked_hours`, `overtime_hours`, `pending_hours dec(8,2)`
      - `overtime_status enum(NONE,PENDING,APPROVED,REJECTED) =NONE`, `pdf_url text`
      - `status enum(PENDING,HOLD,CREDITED) =PENDING`
    - Indexes: U(run_id, employee_id).
61. **hrms_payroll_items**:
    - Columns: `payroll_id NN` (CASCADE), `type enum(EARNING,DEDUCTION,INCENTIVE) NN`, `label str(150) NN`, `salary_component_id` (SET NULL), `amount dec(12,2) =0`, `is_auto bool =0`, `added_by →users`.
62. **hrms_salary_increment_batches**:
    - Columns: `employer_id NN`, `financial_year_id`, `title str(150) NN`, `kind enum(BULK,SINGLE) =BULK`, `type enum(PERCENT,AMOUNT) NN`, `value dec(12,2) NN`, `applies_to enum(BASIC_ONLY,ALL_FIXED) =BASIC_ONLY`, `effective_month`, `effective_year NN`, `effective_date date`, `reason str(500)`, `filters json`, `status enum(DRAFT,APPLIED,REVERTED) =DRAFT`, `applied_by`, `applied_at`, `reverted_at`.
63. **hrms_salary_increment_lines**:
    - Columns: `batch_id NN` (CASCADE), `employee_id NN`, `old_salary_id`, `new_salary_id →hrms_employee_salary`, `old_gross`, `new_gross dec(14,2)`, `old_basic`, `new_basic dec(12,2)`, `excluded bool =0`, `note str(500)`.
    - Indexes: U(batch_id, employee_id).

### Group 8: loans

64. **hrms_loans** [P]:
    - Columns:
      - `employer_id NN`, `employee_id NN`, `loan_number str(30)`
      - `requested_amount dec(12,2) NN`, `requested_installments int NN`, `purpose str(500)`
      - `approved_amount`, `emi_amount dec(12,2)`, `approved_installments int`, `interest_rate dec(6,3)`
      - `on_insufficient_salary enum(SKIP,PARTIAL,FORCE) =SKIP`, `status enum(…10 values…) =PENDING`
      - `approver_id →users`, `reject_reason str(500)`
      - `outstanding_principal dec(12,2) =0`, `first_deduction_month date` (first of month; was a "YYYY-MM" string)
      - `recovery_status enum(NONE,IN_FNF,RECOVERED,WRITTEN_OFF) =NONE`
      - `applied_at`, `approved_at`, `disbursed_at`, `closed_at dt`, `created_by`, `meta json`, `version int =0`
    - Indexes: U(employer_id, loan_number), idx(employer_id, status).
65. **hrms_loan_installments**:
    - Columns: `loan_id NN` (CASCADE), `employer_id NN`, `installment_no int NN`, `due_date date NN`, `period_month`, `period_year`, `emi_amount dec(12,2) NN`, `principal_component`, `interest_component`, `opening_balance`, `closing_balance dec(12,2)`, `status enum(PENDING,PAID,PARTIALLY_PAID,SKIPPED,OVERDUE) =PENDING`, `paid_amount dec(12,2) =0`, `paid_date date`, `schedule_version int =1`, `generated_from_skip_id` (FK added after skip requests, step 67), `version int =0`.
    - Indexes: U(loan_id, installment_no, schedule_version), idx(due_date, status).
66. **hrms_loan_payments**:
    - Columns: `employer_id NN`, `loan_id NN`, `installment_id` (SET NULL), `transaction_id str(64) NN`, `method enum(SALARY_DEDUCTION,ONLINE,ADJUSTMENT,FNF_RECOVERY) =SALARY_DEDUCTION`, `payslip_id →hrms_payroll`, `salary_transaction_id →hrms_salary_transactions`, `period_month`, `period_year`, `amount dec(12,2) NN`, `status enum(INITIATED,SUCCESS,PARTIAL,FAILED,REVERSED) =SUCCESS`, `gateway_reference str(100)`, `failure_reason str(255)`, `paid_at dt`, `reversal_of_payment_id →hrms_loan_payments`, `created_by`.
    - Indexes: U(employer_id, transaction_id).
67. **hrms_loan_skip_requests**:
    - Columns: `employer_id NN`, `loan_id NN`, `installment_id NN`, `new_installment_id →hrms_loan_installments`, `reason str(500)`, `status enum(PENDING,APPROVED,REJECTED) =PENDING`, `approver_id`, `decided_at`, `created_by`.
    - This migration also adds the FK `installments.generated_from_skip_id`.
68. **hrms_loan_ledger** [L]:
    - Columns: `employer_id NN`, `loan_id NN`, `entry_type enum(DISBURSEMENT,PAYMENT,PENALTY,WAIVER,SKIP_DEFERRAL,FORECLOSURE_SETTLEMENT,FNF_RECOVERY,REVERSAL) NN`, `direction enum(DEBIT,CREDIT) NN`, `amount dec(12,2) NN`, `installment_id`, `payment_id`, `balance_after dec(12,2) NN`, `entry_date date NN`, `remarks str(255)`, `created_by`.
69. **hrms_loan_audit_log** [L]:
    - Columns: `employer_id NN`, `entity_type enum(LOAN,INSTALLMENT,SKIP_REQUEST,PAYMENT) NN`, `entity_id char(36) NN`, `loan_id →hrms_loans`, `action str(50) NN`, `actor_id →users`, `old_values`, `new_values json`, `remarks str(500)`.

### Group 9: exits and visas

70. **hrms_exit_settings**:
    - Columns: `employer_id NN`, `default_notice_days int =30`, `default_cooling_days int =180`, `default_allow_leave_during_notice bool =0`, `default_encash_leave bool =1`, `block_loans_during_notice bool =1`.
    - Indexes: U(employer_id).
71. **hrms_exit_checklist_templates**:
    - Columns: `employer_id NN`, `category enum(LOAN,ASSETS,FINANCE,PROJECT,ADMINISTRATION,IT,HR,OTHER) NN`, `label str(150) NN`, `is_required bool =1`, `sort_order int =0`, `is_active bool =1`.
    - Indexes: U(employer_id, category, label).
72. **hrms_employee_exits** [P]:
    - Columns: all exit columns from the schema, plus `employer_id`, `employee_id`, `settlement_scope_project_id →projects`, and `raised_by`, `cancelled_by`, `confirmed_by`, `offline_clearance_uploaded_by →users`.
      - `exit_type enum(RESIGNATION,TERMINATION)`, `reason_category str(40)`, `reason text`
      - `notice_start_date`, `notice_days`, `preferred_last_day`, `original_last_working_day`, `last_working_day`
      - the settlement flags and `settlement_snapshot json`
      - `rehire_eligible`, `cooling_period_days`, `rehire_allowed_from`
      - `status enum(IN_NOTICE,EXITED,COMPLETED,CANCELLED)`, `confirm_mode enum(ON_LWD,IMMEDIATE)`, `cancel_reason`, `confirm_override_reason`
      - the `offline_clearance_*` file columns
    - Indexes: idx(employer_id, status), idx(employee_id, status), idx(last_working_day, status).
73. **hrms_exit_checklist_items**:
    - Columns: `exit_id NN` (CASCADE), `category enum(same 8)`, `label`, `is_required`, `sort_order`, `status enum(PENDING,DONE,NA) =PENDING`, `note str(500)`, `actioned_by`, `actioned_at`, `auto_key str(30)`.
74. **hrms_exit_documents**:
    - Columns: `exit_id NN`, `doc_type enum(TERMINATION_LETTER,RELIEVING_LETTER,FNF_STATEMENT,CLEARANCE_CERTIFICATE) NN`, `storage_key str(500) NN`, `version int =1`, `is_final bool =0`, `generated_by`, `generated_at dt NN`, `sent_at dt`.
    - Indexes: U(exit_id, doc_type).
75. **hrms_exit_events** [L]:
    - Columns: `exit_id NN`, `event_type enum(…18 values…) NN`, `payload json`, `actor_user_id`.
76. **hrms_exit_visas** [P]:
    - Columns: `employer_id NN`, `employee_id NN`, `visa_type enum(SINGLE_EXIT,MULTIPLE_EXIT,FINAL_EXIT) NN`, `status enum(…7…) =PENDING_APPROVAL`, `requested_from`, `requested_to date`, `reason text`, `visa_number str(100)`, `valid_from`, `valid_until`, `final_exit_date date`, `max_exits int =1`, `exits_used int =0`, `approval_request_id`, `document_id →hrms_employee_documents`, `applied_by`, `applied_at`, `reviewed_at`, `reject_reason text`.
77. **hrms_exit_visa_trips**:
    - Columns: `exit_visa_id NN` (CASCADE), `employer_id NN`, `employee_id NN`, `departure_date date NN`, `expected_return_date`, `actual_return_date date`, `status enum(…7…) =PENDING_APPROVAL`, `notes text`, `recorded_by`, `approved_by →users`.

### Group 10: staffing billing

78. **hrms_staffing_rates**:
    - Columns: `employer_id NN`, `staffing_company_id`, `employee_id`, `rate_type enum(OVERTIME_MULTIPLIER,HOURLY_BILL) NN`, `value dec(12,2) NN`, `effective_from date NN`, `created_by`.
    - Indexes: idx(employer_id, staffing_company_id, employee_id, rate_type, effective_from).
79. **hrms_staffing_bills** [P]:
    - Columns: `employer_id NN`, `staffing_company_id NN`, `bill_no str(30) NN`, `period_month`, `period_year NN`, `status enum(DRAFT,PENDING_APPROVAL,APPROVED,REJECTED,PAID) =DRAFT`, `reject_reason text` (**new, A10**), `currency char(3) ='SAR'`, `total_amount dec(14,2) =0`, `approval_request_id`, `generated_by`, `generated_at`, `sent_to_portal bool =0`, `sent_at dt`, `paid_at dt`, generated `live_key`.
    - Indexes: U(employer_id, bill_no), U(employer_id, staffing_company_id, period_year, period_month, live_key).
80. **hrms_staffing_bill_items**:
    - Columns: `bill_id NN` (CASCADE), `employer_id NN`, `employee_id NN`, `project_id →projects`, `gross_amount`, `total_deductions`, `net_amount dec(12,2)`, `overtime_hours dec(8,2)`, `overtime_amount dec(12,2)`, `worked_hours`, `standard_hours dec(8,2)`, `attendance_factor dec(8,4)`, `meta json`.
    - Indexes: idx(bill_id, employee_id, project_id).

### Group 11: contracts

81. **hrms_contract_types**:
    - Columns: `employer_id NN`, `name str(150) NN`, `code str(100) NN`, `description str(500)`, `is_active bool =1`, `created_by`.
    - Indexes: U(employer_id, code).
82. **hrms_contract_documents** [P]:
    - Columns: `employer_id NN`, `name str(255) NN`, `original_file_name`, `file_path`, `file_url str(512)`, `file_type enum(PDF,DOCX,DOC) =PDF`, `mime_type str(120)`, `file_size_bytes bigint`, `page_count int`, `status enum(SAVED,ARCHIVED) =SAVED`, `uploaded_by`, `meta json`.
83. **hrms_contract_templates** [P]:
    - Columns: `employer_id NN`, `document_id` (SET NULL), `name str(255) NN`, `description text`, `audience_type enum(EMPLOYEE,STAFFING_COMPANY,VENDOR,CLIENT,COLLABORATING_COMPANY) =EMPLOYEE`, `page_count`, `status enum(DRAFT,ACTIVE,ARCHIVED) =ACTIVE`, `created_by`, `meta json`.
84. **hrms_contract_template_fields**:
    - Columns: `template_id NN` (CASCADE), `employer_id NN`, `page_no int =1`, `field_type enum(INPUT,CHECKBOX,SIGNATURE,DB_COLUMN) NN`, `label`, `field_key`, `checked_value`, `db_source enum`, `db_column`, `pos_x`, `pos_y dec(6,3) =0`, `width`, `height dec(6,3)`, `is_required bool =1`, `assigned_role enum(PRIMARY_SIGNER,APPROVER,VIEWER,WITNESS)`, `sort_order int =0`, `meta json`.
85. **hrms_contracts** [P]:
    - Columns:
      - `employer_id NN`, `contract_type_id →hrms_contract_types` (**new, A14**), `template_id`, `document_id`, `project_id`, `approval_request_id`
      - `reference_no str(60)`, `name str(255) NN`, `audience_type enum(same 5)`, `module_label str(80)`
      - `status enum(DRAFT,SENT,VIEWED,SUBMITTED,APPROVED,REJECTED,EXPIRED,COMPLETED) =DRAFT`, `signing_order bool =0`, `page_count`, `notes text`
      - `sent_at`, `viewed_at`, `submitted_at`, `approved_at`, `completed_at`, `expires_at dt`
      - `start_date`, `end_date`, `renewal_due date`
      - `approved_by`, `created_by`, `meta json`
    - Indexes: U(employer_id, reference_no), idx(employer_id, status).
86. **hrms_contract_recipients**:
    - Columns: `contract_id NN` (CASCADE), `employer_id NN`, `recipient_type enum(EMPLOYEE,STAFFING_COMPANY,VENDOR,CLIENT,EXTERNAL,COLLABORATING_COMPANY) NN`, `employee_id`, `staffing_company_id`, `partner_employer_id →employers`, `recipient_name`, `recipient_email str(160)`, `recipient_phone str(40)`, `role enum(PRIMARY_SIGNER,APPROVER,VIEWER,WITNESS) =PRIMARY_SIGNER`, `signing_sequence int =1`, `status enum(PENDING,SENT,VIEWED,SIGNED,SUBMITTED,DECLINED) =PENDING`, `access_token_hash str(128)` (hashed; was plaintext), `color_index int`, `sent_at`, `viewed_at`, `signed_at`, `submitted_at dt`, `reject_reason str(255)`.
    - Indexes: U(access_token_hash).
87. **hrms_contract_fields**:
    - Columns: `contract_id NN` (CASCADE), `employer_id NN`, `recipient_id` (SET NULL), `template_field_id` (SET NULL), the same layout columns as template fields, `value text`, `filled_at dt`.
88. **hrms_contract_activities** [L]:
    - Columns: `employer_id NN`, `contract_id` (CASCADE), `recipient_id` (SET NULL), `action enum(…12…) NN`, `actor_user_id`, `description str(255)`, `meta json`.

### Group 12: collaboration

89. **project_collaboration_roles** [P]:
    - Columns: `project_id NN`, `employer_id NN`, `name str(120) NN`, `description str(255)`, `is_active bool =1`.
    - Indexes: U(project_id, name).
90. **project_collaboration_role_permissions**:
    - Columns: `role_id NN` (CASCADE), `module_key str(100) NN`, `can_read`, `can_create`, `can_update`, `can_delete bool =0`.
    - Indexes: U(role_id, module_key).
91. **project_invitations**:
    - Columns: `project_id NN`, `inviting_employer_id NN`, `invited_employer_id`, `parent_employer_id →employers`, `collaboration_role_id`, `invitation_batch_id char(36)`, `invited_email str(255)`, `role_in_project enum(CONSULTANT,EPC,SUBCONTRACTOR) NN`, `token str(120) NN`, `status enum(PENDING,ACCEPTED,DECLINED,EXPIRED,CANCELLED) =PENDING`, `expires_at`, `responded_at dt`, `parent_approval_status enum(NOT_REQUIRED,PENDING,APPROVED,REJECTED) =NOT_REQUIRED`, `parent_approved_at dt`.
    - Indexes: U(token), idx(project_id, status), idx(invited_email).
92. **project_participants** [P]:
    - Columns: `project_id NN`, `employer_id NN`, `collaboration_role_id`, `role_in_project enum(OWNER,CONSULTANT,EPC,SUBCONTRACTOR) NN`, `status enum(INVITED,ACCEPTED,DECLINED,REMOVED) =INVITED`, `joined_at dt`.
    - Indexes: U(project_id, employer_id).
93. **project_participant_edges**:
    - Columns: `project_id NN`, `parent_employer_id NN`, `child_employer_id NN`.
    - Indexes: U(project_id, parent_employer_id, child_employer_id).
94. **project_visibility_closure** [L]:
    - Columns: `project_id NN`, `ancestor_employer_id NN`, `descendant_employer_id NN`, `depth int =1`.
    - Indexes: U(project_id, ancestor_employer_id, descendant_employer_id).
95. **project_participant_permissions**:
    - Columns: `project_id NN`, `employer_id NN`, `granted_by_employer_id`, `module_key str(100) NN`, `can_read`, `can_create`, `can_update`, `can_delete bool =0`.
    - Indexes: U(project_id, employer_id, module_key).
96. **project_employee_deployments**:
    - Columns: `project_id NN`, `partner_employer_id NN`, `partner_employee_id →employees NN`, `deployed_by →users`, `start_date`, `end_date date`, `is_active bool =1`.
    - Indexes: U(project_id, partner_employee_id).

### Group 13: year-end

97. **hrms_year_close_steps**:
    - Columns: `financial_year_id NN` (CASCADE), `step enum(READINESS,LEAVE,PAYROLL,BILLING,SETUP,CLOSE) NN`, `status enum(PENDING,IN_PROGRESS,DONE,SKIPPED) =PENDING`, `result json`, `done_by`, `done_at`.
    - Indexes: U(financial_year_id, step).
98. **hrms_year_documents**:
    - Columns: `financial_year_id NN`, `employee_id`, `staffing_company_id` (RESTRICT), `doc_type enum(ANNUAL_PAY_STATEMENT,SALARY_REGISTER,LEAVE_SUMMARY,LOAN_STATEMENT,STAFFING_STATEMENT,OVERTIME_SUMMARY,HEADCOUNT_REPORT) NN`, `storage_key str(500) NN`, `version int =1`, `generated_by`, `generated_at dt NN`, `sent_at`, generated `employee_key`/`staffing_key`.
    - Indexes: U(financial_year_id, employee_key, staffing_key, doc_type).
99. **hrms_year_events** [L]:
    - Columns: `financial_year_id NN`, `event_type enum(…16…) NN`, `payload json`, `actor_user_id`.

---

## 5. Relationships (Sequelize associations)

- **Tenant:**
  - `Employer` hasMany almost every model through `employer_id`.
  - `Employer` belongsTo `User` (owner) and `IndustryType`.
- **Identity:**
  - `User` hasMany `HrmsAccount`, `Employee` and `Notification`, and hasOne `PasswordResetOtp` (latest).
  - `HrmsAccount` belongsTo `User`, `Employer` and `Role`, and hasMany `HrmsSession`.
- **Permissions:** `Role` belongsToMany `Module` through `RolePermission`, and hasMany `HrmsAccount`.
- **Org:**
  - `Department` hasMany `Designation`, and belongsTo `Employee` as `head`.
  - `Office` hasMany `Project`. `Project` belongsTo `Office` and `City`. `City` belongsTo `Country`.
- **Employee:**
  - belongsTo `User`, `Department`, `Designation`, `CompanyShift`, `Office` and `StaffingCompany`.
  - belongsToMany `Project` through `EmployeeProject`.
  - hasMany `EmployeeDocument`, `EmployeeDependent`, `EmployeeSalary`, `Attendance`, `LeaveRequest`, `LeaveBalance`, `Payroll`, `Loan`, `EmployeeExit` and `ExitVisa`.
  - belongsToMany `LeavePolicy` through `EmployeeLeavePolicy`.
- **Salary:**
  - `EmployeeSalary` belongsToMany `SalaryComponent` through `EmployeeSalaryComponent`.
  - `SalaryIncrementBatch` hasMany `SalaryIncrementLine`.
- **Approvals:**
  - `ApprovalGroup` hasMany `ApprovalGroupMember`, `ApprovalAssignment` and `ApprovalRequest`.
  - `ApprovalRequest` hasMany `ApprovalRequestLog`.
  - The request modules (correction, overtime, leave, encashment, payroll run, staffing bill, loan, exit visa, contract) each belongsTo `ApprovalRequest`.
- **Leave:**
  - `LeaveType` hasMany `LeavePolicy`.
  - `LeaveRequest` hasMany `LeaveRequestDay` and `LeaveAttachment`.
  - `LeaveBalance` hasMany `LeaveBalanceTransaction` and `LeaveYearOverride`.
- **Payroll:** `PayrollRun` hasMany `Payroll`, and `Payroll` hasMany `PayrollItem`.
- **Loans:**
  - `Loan` hasMany `LoanInstallment`, `LoanPayment`, `LoanSkipRequest`, `LoanLedger` and `LoanAuditLog`.
  - `LoanPayment` belongsTo `LoanPayment` as `reversalOf`.
- **Exits:**
  - `EmployeeExit` hasMany `ExitChecklistItem`, `ExitDocument` and `ExitEvent`.
  - `ExitVisa` hasMany `ExitVisaTrip`.
- **Staffing:**
  - `StaffingCompany` belongsToMany `Project` through `StaffingCompanyProject`, and hasMany `StaffingBill`, `StaffingRate` and `Employee`.
  - `StaffingBill` hasMany `StaffingBillItem`.
- **Contracts:**
  - `ContractDocument` hasMany `ContractTemplate` and `Contract`.
  - `ContractTemplate` hasMany `ContractTemplateField`.
  - `Contract` belongsTo `ContractType`, and hasMany `ContractRecipient`, `ContractField` and `ContractActivity`.
- **Collaboration:**
  - `Project` hasMany `ProjectInvitation`, `ProjectParticipant`, `ProjectParticipantEdge`, `ProjectParticipantPermission`, `ProjectEmployeeDeployment` and `ProjectCollaborationRole`.
  - `ProjectCollaborationRole` hasMany `ProjectCollaborationRolePermission`.
- **Financial year:** `FinancialYear` hasMany `PeriodLock`, `NumberSequence`, `YearCloseStep`, `YearDocument`, `YearEvent`, `LeaveBalance` and `SalaryIncrementBatch`.

---

## 6. Seed data (development only)

| Seeder | Content |
|---|---|
| 01 lookups | countries (SA, IN, PK, EG, PH, BD), cities (Riyadh, Jeddah, Dammam, …), industry types, all modules (from the UI `MODULES`) |
| 02 company | one employer "Al Noor Construction" owned by `admin@hrms.test`; time settings; FY 2026 (OPEN); exit settings and checklist template |
| 03 roles | roles: Sub Admin (most modules R/C/U), HR Officer, Payroll Officer, Employee (self-service read), each with role_permissions |
| 04 users & accounts | the 4 test users (D6) with `hrms_accounts` (ADMIN, SUB_ADMIN, STAFFING_COMPANY, GENERAL_EMPLOYEE) |
| 05 org | 3 departments with 2 designations each, 1 head office, 2 projects, 2 shifts with week-offs, 8 Saudi public holidays for 2026 |
| 06 staffing | 1 staffing company (login = `staffing@hrms.test`) linked to 1 project |
| 07 employees | 8 employees (incl. `subadmin@` and `employee@`; 2 supplied by the staffing company), project assignments, salary structures, 1–2 documents each, 1 dependent |
| 08 setup | document types (Iqama, Passport, …), salary components (Basic, Housing, Transport, GOSI, …), 3 leave types with policies, employee leave policies and balances |
| 09 approvals | approval groups for LEAVE, OVERTIME, CORRECTION, PAYROLL, LOAN (2 levels) and their assignments |
| 10 activity | a few attendance days, 2 leave requests, 1 overtime, 1 correction, 1 payroll run (DRAFT) with payslips, 1 loan with installments, 1 exit visa, 1 contract type and template |

---

## 7. Files to create or change

```
backend/
├── package.json                 scripts (see 8), deps
├── .sequelizerc                 config / models / migrations / seeders paths
├── .eslintrc / eslint.config.js
├── jest.config.js               testEnvironment node, setup file
├── src/
│   ├── app.js                   cors(CLIENT_URL), helmet, json, morgan, /api routes, 404, errorHandler
│   ├── server.js                dotenv, app.listen(PORT)
│   ├── config/
│   │   ├── env.js               dotenv load + required-var check (never logs values)
│   │   └── database.js          sequelize-cli config: development / test (DB_NAME / DB_NAME_TEST), mysql, utf8mb4_unicode_ci, timezone +00:00
│   ├── models/
│   │   ├── index.js             loads all models, runs associate()
│   │   └── <Model>.js × 99      one per table (section 4)
│   ├── routes/index.js          mounts /health
│   ├── routes/health.routes.js
│   ├── controllers/health.controller.js
│   ├── middlewares/             requireAuth.js, requireRole.js, validate.js, errorHandler.js
│   ├── utils/ErrorHandler.js
│   └── constants/               accessLevels.js, modules.js (mirrors hrms/src/constants/permissions.js)
├── migrations/                  99 files, numbered in section-4 order (YYYYMMDD0000NN-create-<table>.js), plus 0 extra FK migrations (circular FKs are added inside the later table's migration)
├── seeders/                     10 files (section 6)
└── tests/
    ├── setup.js                 NODE_ENV=test, migrate the test DB once
    ├── health.test.js           GET /api/health → 200 { success: true, data: { status: "ok" } }
    └── models.test.js           for every model: create a minimal valid row (with parent rows) → reload with all associations included → assert no error
docs/test-users.md               new roles (D6)
CLAUDE.md                        Roles line → ADMIN, SUB_ADMIN, EMPLOYEE, GENERAL_EMPLOYEE, STAFFING_COMPANY
docs/backend-plan.md             this file (decisions record)
```

`hrms_schema/` stays untouched as the reference. Its all-in-one migration is **not** used.

---

## 8. npm scripts

```
dev             nodemon src/server.js
start           node src/server.js
lint            eslint .
test            cross-env NODE_ENV=test jest --runInBand
db:create       sequelize-cli db:create
db:create:test  cross-env NODE_ENV=test sequelize-cli db:create
db:migrate      sequelize-cli db:migrate
db:migrate:test cross-env NODE_ENV=test sequelize-cli db:migrate
db:seed         sequelize-cli db:seed:all
db:reset        sequelize-cli db:migrate:undo:all && npm run db:migrate && npm run db:seed   (dev DB only)
db:setup        npm run db:create && npm run db:create:test && npm run db:migrate && npm run db:migrate:test && npm run db:seed
```

---

## 9. Environment variables (read only through dotenv)

The code will expect these names. **The agent can't read `backend/.env.example`** because the deny rule `Read(**/.env.*)` blocks it. The user confirmed on 2026-10-19 that these names match `.env.example`.

`PORT`, `CLIENT_URL`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_NAME_TEST`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`

---

## 10. Execution order and commits (one step = one commit, on branch `feat/backend-foundation`)

1. **Scaffold.** Write the health test first, then the app, middlewares and lint. `npm test` passes (the health test doesn't need the DB).
2. **DB config and scripts.** `.sequelizerc`, `database.js`, the npm scripts. Run `npm run db:create` and `db:create:test`.
3. **Migrations and models, by group** (groups 0–13). Write `models.test.js` cases for the group first, then the migrations and models. Run `db:migrate` and `db:migrate:test`, then `npm test`. Each group is a commit.
4. **Seeders.** `npm run db:seed` runs cleanly; `db:reset` runs cleanly.
5. **Docs.** Update `test-users.md` and the `CLAUDE.md` roles line.

**Done when:**
- `npm run lint` shows 0 errors.
- `npm test` is green: health, plus every model creates and loads its associations.
- `npm run db:setup` runs from scratch on an empty MySQL.
- `db:reset` works.
