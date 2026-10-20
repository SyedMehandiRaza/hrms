# Standards

Rules every module follows. Decided in the Auth + Company planning session (2026-10-19).
Module-specific rules live in `docs/plans/`; terms in `docs/CONTEXT.md`; reasons in `docs/adr/`.

---

## 1. Passwords

- **Rule (UI and server, identical):** 8–72 characters, with at least one uppercase letter, one lowercase
  letter, one digit and one special character. 72 is the bcrypt input limit.
- Applies wherever a password is **set**: sign up, reset, change, set-password (setup link), forced change
  after a temporary password.
- **Login only checks that a password is present** (no format check), so older passwords keep working
  if the rule changes.
- On change/reset the new password must differ from the current one (`AUTH_PASSWORD_SAME`).
- Hashing: bcrypt, cost 12. Password fields are never returned by the API.
- Message for a failed rule (`AUTH_PASSWORD_WEAK`): "Password must be 8–72 characters and include an
  uppercase letter, a lowercase letter, a number and a special character."

## 2. Error responses

```json
{ "success": false, "code": "DEPARTMENT_NAME_TAKEN", "message": "A department with this name already exists." }
{ "success": false, "code": "VALIDATION_FAILED", "message": "Please fix the highlighted fields.",
  "errors": { "name": "Department Name is required" } }
```

- `code`: stable key, never translated. Tests assert on `code` and `message`.
- `message`: translated by the `Accept-Language` request header (`en` | `ar`, default `en`). The UI sends
  the current `localStorage.lang` and shows `message` exactly as returned.
- `errors`: only on validation failures. Field → message map, read by `hrms/src/utils/applyFieldErrors.js`.
- Validation failures are **400**. Other statuses: 401 not logged in / session invalid, 403 not allowed,
  404 not found **or belongs to another company**, 409 conflict, 423 account locked, 429 rate limited,
  500 unexpected (never leaks details).
- One catalog: `backend/src/constants/messages.js` (`code → { status, en, ar }`). Field messages reuse the
  UI's existing i18n strings so client and server validation say the same thing.
- New Arabic strings are drafted with the code and marked for native review.

## 3. Tenancy

- `employer_id` always comes from the access token, never from the body or query.
- Every query on tenant data is scoped by it. A record of another company returns **404**, not 403.
- Every module's tests include a second company to prove isolation.

## 4. Permissions

- Access level (on `hrms_accounts`) picks the panel. ADMIN (the company owner) bypasses role checks.
- Everyone else is limited by their role's module × read/create/update/delete flags.
  An account with no role has every flag false.
- Permissions are loaded on every request, so role changes apply immediately.
- 401 when the token is missing/expired/revoked; 403 when the action isn't allowed.

## 5. Validation conventions

- Strings are trimmed. Emails are lowercased.
- Names and codes are unique per company and case-insensitive (collation `utf8mb4_unicode_ci`).
- Codes are stored uppercase.
- Soft-deleted rows don't block reuse of a unique name/code: unique keys include the generated
  `live_key` column (NULL when deleted).
- Fields that the UI marks "no emojis" are rejected by the server too.

## 6. Email

- All mail goes through `backend/src/services/mailer` with driver `MAIL_DRIVER`
  (`console` in dev, `memory` in tests, `smtp` for real delivery via `SMTP_HOST/PORT/SECURE/USER/PASS`).
  Tests read a captured outbox. Credentials and passwords are never logged.
- Language follows `users.lang_key`.

## 7. Message catalog (exact English text)

Arabic lives next to each code in the backend catalog; new Arabic strings are marked for native review.
Auth + Company codes added 2026-10-19. Every module appends its codes here.

### 7.1 Top-level message by code
| Code | HTTP | Message |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Please fix the highlighted fields. |
| `INVALID_JSON` | 400 | Malformed JSON body |
| `AUTH_REQUIRED` | 401 | Please log in to continue. |
| `AUTH_TOKEN_EXPIRED` | 401 | Your session has expired. Please log in again. |
| `AUTH_REFRESH_INVALID` | 401 | Your session has expired. Please log in again. |
| `FORBIDDEN` | 403 | You don't have permission to do this. |
| `NOT_FOUND` | 404 | The requested record was not found. |
| `RATE_LIMITED` | 429 | Too many requests. Please try again in a minute. |
| `INTERNAL_ERROR` | 500 | Something went wrong. Please try again. |
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password. |
| `AUTH_ACCOUNT_LOCKED` | 423 | Too many failed attempts. Try again in 15 minutes. |
| `AUTH_ACCOUNT_INACTIVE` | 403 | Your account is inactive. Contact your administrator. |
| `AUTH_COMPANY_INACTIVE` | 403 | Your company's access is disabled. Contact support. |
| `AUTH_SETUP_EXPIRED` | 403 | Your temporary password has expired. Ask your administrator to resend it. |
| `AUTH_PASSWORD_CHANGE_REQUIRED` | 403 | Please change your temporary password to continue. |
| `AUTH_RESET_SENT` | 200 | If an account exists for this email, you'll receive a reset code. |
| `AUTH_OTP_INVALID` | 400 | This code is incorrect or has expired. Please try again. |
| `AUTH_OTP_ATTEMPTS_EXCEEDED` | 400 | Too many incorrect attempts. Please request a new code. |
| `AUTH_OTP_RESEND_TOO_SOON` | 429 | Please wait before requesting another code. |
| `AUTH_RESET_TOKEN_INVALID` | 400 | Your reset session has expired. Please start again. |
| `AUTH_SETUP_LINK_INVALID` | 400 | This link is invalid or has expired. Ask your administrator to resend it. |
| `AUTH_PASSWORD_WEAK` | 400 | Password must be 8–72 characters and include an uppercase letter, a lowercase letter, a number and a special character. |
| `AUTH_PASSWORD_MISMATCH` | 400 | Passwords do not match |
| `AUTH_PASSWORD_SAME` | 400 | New password must be different from your current one. |
| `AUTH_CURRENT_PASSWORD_WRONG` | 400 | Your current password is incorrect. |
| `AUTH_EMAIL_TAKEN` | 409 | An account with this email already exists. Log in or reset your password. |
| `ACCOUNT_EMAIL_IN_OTHER_COMPANY` | 409 | This email is already used by another company. |
| `ACCOUNT_ADMIN_EXISTS` | 409 | This company already has an owner. Add other admins as Sub Admin. |
| `ACCOUNT_OWNER_PROTECTED` | 403 | The company owner's account can't be changed. |
| `SESSION_REVOKE_CURRENT` | 400 | You can't end your current session here. Use Log out instead. |
| `COMPANY_LOGO_INVALID` | 400 | Logo must be a JPG or PNG image up to 2 MB. |
| `COMPANY_TIMEZONE_INVALID` | 400 | Choose a valid timezone |
| `COMPANY_FY_START_INVALID` | 400 | Choose a month from 1 to 12 |
| `COMPANY_FY_START_LOCKED` | 409 | The start month can't change after a financial year has been closed. |
| `DEPARTMENT_NAME_TAKEN` | 409 | A department with this name already exists. |
| `DEPARTMENT_CODE_TAKEN` | 409 | A department with this code already exists. |
| `DEPARTMENT_IN_USE` | 409 | This department has employees and can't be deleted. |
| `DESIGNATION_NAME_TAKEN` | 409 | A designation with this name already exists in this department. |
| `DESIGNATION_CODE_TAKEN` | 409 | A designation with this code already exists. |
| `DESIGNATION_IN_USE` | 409 | This designation has employees and can't be deleted. |
| *Workforce + lifecycle codes added 2026-10-20 (`docs/plans/workforce-and-lifecycle.md`)* | | |
| `OFFICE_NAME_TAKEN` | 409 | A head office with this name already exists. |
| `OFFICE_IN_USE` | 409 | This head office has a project and can't be deleted. |
| `OFFICE_IMAGE_INVALID` | 400 | Image must be a JPG or PNG up to 2 MB. |
| `PROJECT_IMAGE_INVALID` | 400 | Image must be a JPG or PNG up to 2 MB. |
| `PROJECT_NAME_TAKEN` | 409 | A project with this name already exists. |
| `PROJECT_OFFICE_TAKEN` | 409 | This head office already has a project. |
| `PROJECT_HAS_EMPLOYEES` | 409 | Move this project's employees to another main project before completing it. |
| `PROJECT_START_AFTER_ASSIGNMENTS` | 409 | Some employees were assigned before this date. |
| `PROJECT_NOT_ACTIVE` | 409 | Only active projects can take new employees. |
| `PROJECT_GENERAL_EMPLOYEE_SINGLE` | 409 | General employees can belong to only one project. |
| `PROJECT_REMOVE_MAIN` | 409 | This is the employee's main project. Change their main project first. |
| `APPROVAL_GROUP_NAME_TAKEN` | 409 | An approval group with this name already exists. |
| `APPROVAL_GROUP_CODE_TAKEN` | 409 | An approval group with this code already exists. |
| `APPROVAL_GROUP_IN_USE` | 409 | This approval group is in use and can't be removed. |
| `APPROVAL_GROUP_HAS_PENDING` | 409 | This group has pending requests. Decide them before removing levels. |
| `APPROVAL_GROUP_PROJECT_MISMATCH` | 409 | This approval group belongs to a different project. |
| `APPROVAL_ROUTING_PER_MODULE_DISABLED` | 400 | Per-module routing isn't available yet. |
| `APPROVAL_NOT_YOUR_TURN` | 403 | This request isn't waiting for your approval. |
| `APPROVAL_ALREADY_DECIDED` | 409 | This request has already been decided. |
| `LEAVE_TYPE_NAME_TAKEN` | 409 | A leave type with this name already exists. |
| `LEAVE_TYPE_CODE_TAKEN` | 409 | A leave type with this code already exists. |
| `LEAVE_TYPE_IN_USE` | 409 | This leave type is assigned to employees and can't be deleted. |
| `LEAVE_POLICY_VERSIONING_DISABLED` | 409 | Policy versions aren't available yet. |
| `SHIFT_NAME_TAKEN` | 409 | A shift with this name already exists. |
| `SHIFT_IN_USE` | 409 | This shift is assigned to employees and can't be deleted. |
| `SHIFT_WEEKOFF_LOCKED` | 409 | Week-offs in a closed or past period can't be changed. |
| `SALARY_COMPONENT_NAME_TAKEN` | 409 | A salary component with this name already exists. |
| `SALARY_COMPONENT_SYSTEM` | 403 | Default components can't be changed. |
| `SALARY_COMPONENT_TYPE_LOCKED` | 409 | The type can't change once employees use this component. |
| `EMPLOYEE_ID_NUMBER_TAKEN` | 409 | An employee with this ID number already exists. |
| `EMPLOYEE_EMAIL_TAKEN` | 409 | An employee with this email already exists. |
| `EMPLOYEE_PHONE_TAKEN` | 409 | An employee with this phone number already exists. |
| `EMPLOYEE_EXITED` | 409 | This employee has exited. Use Rehire. |
| `EXIT_ALREADY_OPEN` | 409 | This employee already has an open exit. |
| `EXIT_INVALID_STATE` | 409 | This action isn't possible in the exit's current status. |
| `SHIFT_WEEKOFF_NO_NEXT_FY` | 409 | The next financial year doesn't exist or is locked. |
| `REHIRE_NOT_ALLOWED` | 409 | This employee isn't eligible for rehire until {date}. |
| `REHIRE_NOT_ELIGIBLE` | 409 | This employee isn't eligible for rehire. |

### 7.2 Field messages (`errors` map). **Bold** = new string, add to UI EN + AR.
| Form | Field → messages |
|---|---|
| Login | email: "Email is required", "Invalid email address" · password: "Password is required" |
| Sign up | companyName: "Company name is required", "Company name must be at least 2 characters", **"Company name cannot exceed 100 characters"** · name: "Your name is required", "Name must be at least 2 characters", **"Name cannot exceed 100 characters"** · email: as Login · phone: "Invalid phone number" (replaced by the Countries, cities, phones rules in geo 04) · password: `AUTH_PASSWORD_WEAK` text · confirmPassword: "Please confirm your password", "Passwords do not match" |
| Forgot | email: as Login |
| Verify OTP | otp: "Please enter complete OTP" |
| Reset / Set / Change password | newPassword: "Password is required", `AUTH_PASSWORD_WEAK` text, `AUTH_PASSWORD_SAME` text · confirmPassword: "Please confirm your password", "Passwords do not match" · currentPassword: "Password is required" |
| Company profile | companyName: "Company name is required", "Company name must be at least 2 characters", **"Company name cannot exceed 100 characters"** · industry: "Please select an industry" · phone: "Phone is required", "Enter a valid phone number (6–15 digits)" (replaced by the Countries, cities, phones rules in geo 04) · email: "Email is required", "Enter a valid email" · address: "Address is required", **"Address cannot exceed 500 characters"** |
| Time settings | timezone: "Choose a valid timezone" · fy_start_month: "Choose a month from 1 to 12" |
| Department | name: "Department Name is required", "Department Name must be at least 2 characters", "Department Name cannot exceed 150 characters", "Department Name cannot contain emojis" · code: "Dept. Code is required", "Dept. Code cannot exceed 50 characters", "Dept. Code cannot contain emojis" · description: "Description cannot exceed 2000 characters", "Description cannot contain emojis" · deptHeadId: **"Select an active employee of this company."** |
| Designation | name: "Designation Name is required", "Designation Name must be at least 2 characters", "Designation Name cannot exceed 150 characters", "Designation Name cannot contain emojis" · code: "Designation Code cannot exceed 50 characters", "Designation Code cannot contain emojis" · description: as Department |

#### Countries, cities, phones (added 2026-10-20, `docs/plans/countries-cities-phones.md`)
These apply to every form with these fields and **replace** the older phone texts ("Invalid phone number",
"Enter a valid phone number (6–15 digits)").

| Field | Messages |
|---|---|
| phone | "Phone number is required" · **"Enter a valid phone number for the selected country."** |
| phoneCountry | **"Select the phone number's country."** |
| countryId / residenceCountryId | **"Select a country."** |
| cityId / residenceCityId | **"Select a city in the selected country."** |
| nationalityCountryId | "Please select a nationality" |

#### Workforce + lifecycle forms (added 2026-10-20)
Field keys are the request body keys. Unbolded texts already exist in the UI's EN locale files.

| Form | Field → messages |
|---|---|
| Head office | name: "Head office name is required", "At least 2 characters required", **"Head office name cannot exceed 100 characters"**, "Only letters, numbers, apostrophes and single spaces allowed", "Multiple spaces are not allowed" · email: "Email is required", "Enter a valid email address" · phone / phoneCountry: as in Countries, cities, phones · countryId / cityId: as in Countries, cities, phones · location: "Location is required", "At least 3 characters", "Maximum 255 characters allowed", "Invalid location format" · latitude: **"Enter a valid latitude"** · longitude: **"Enter a valid longitude"** |
| Project | name: "Project name is required", "At least 2 characters required", "Project name cannot exceed 255 characters", "Multiple spaces are not allowed", "Invalid characters used" · officeId: "Please select an office from the list" · startDate: "Start date is required" · endDate: "End date is required", "End date must be after start date" (end = start is allowed) · location / latitude / longitude: "Please select a location on the map" · radius: "Radius is required", "Radius must be at least 50 meters", "Radius cannot exceed 100,000 meters" · description: "Description cannot exceed 1000 characters" · status: **"This status change isn't allowed."** |
| Project assign | employeeIds: "Select at least one employee to assign", **"In-notice or exited employees can't be assigned."** |
| Shift | name: "Shift Name is required", **"Shift Name cannot exceed 50 characters"** · start_time: "Start Time is required" · end_time: "End Time is required", **"End time must differ from start time."** · effective_from: **"Choose a date from the start of the financial year that isn't in a closed or locked period."** |
| Week-offs | dates: **"Every date must fall in an existing financial year."** |
| Leave type / policy | name: "Leave Name is required", "Must be at least 2 characters", "Cannot exceed 150 characters", "Emojis are not allowed" · code: "Leave Code is required", **"Leave Code must be 1–10 letters or numbers"** · yearly_quota: "Yearly quota must be 0–365 days" · accrual_method: "Choose monthly accrual or upfront" · monthly_accrual: **"Monthly accrual can't be negative"** · effective_to: "effective_to must be after effective_from" · max_carry_forward_days: "max_carry_forward_days must be greater than 0 when carry forward is allowed" · carry_forward_expiry_months: "Carry-forward expiry must be a whole number of months from 0 to 36" · max_encashment_days: "max_encashment_days must be greater than 0 when encashment is allowed" · year_end_excess: "Choose lapse or encash" |
| Salary component | name: "Component Name is required", **"Component Name must be 2–100 characters"**, "Emojis are not allowed" · type: "Component Type is required" · description: **"Description cannot exceed 255 characters"** |
| Approval group | name: "Group name is required", "At least 2 characters", "Must be 100 characters or less" · code: "Group code is required", "At least 2 characters", "Must be 50 characters or less" · description: "Must be 1000 characters or less" · projectId: "Please select a project", "At least one approver must be an employee of the selected project." · members: "Add at least one approver", "Employee cannot be selected multiple times. Each employee can only appear once in the approval hierarchy.", **"Levels must start at 1 with no gaps."**, "Select an active employee of this company." |
| Approval decision (reject, owner override) | reason: "Reason must be 5–500 characters" |
| Employee draft | data: **"Draft is too large (max 1 MB)."** |
| Employee (create, edit) | name: "Full name is required", "At least 2 characters required", "Multiple spaces are not allowed" · country_emp_id: "Country Employee ID is required", "At least 3 characters required", "Must be 10 characters or less", "Only letters, numbers and dashes allowed" · email: "Email address is required", "Enter a valid email address" · phone / phoneCountry, residenceCountryId / residenceCityId, nationalityCountryId: as in Countries, cities, phones · employmentType: "Please select employment type" · accessLevel: "Access level is required", **"Choose Employee, General employee or Sub admin."** · roleId: "Role is required" (SUB_ADMIN only) · projectIds: "Select at least one project", "A General Employee can be assigned to only one project", **"Select active projects only."** · mainProjectId: "Select a main project", "Main project must be one of the selected projects" · joiningDate: **"Joining date can't be before the main project's start date."**, **"Joining date can't be more than 12 months ahead."** · departmentId: **"Select an active department."** · designationId: **"Select an active designation of this department."** · staffingCompanyId: **"A staffing company applies only to contract employees."**, **"Select an active staffing company."** · leavePolicyIds: "Select at least one leave policy", **"Choose one policy per leave type."**, **"Select active leave policies only."** · approvalGroupId: **"Select an approval group."** · currency: **"Currency must be SAR."** · salaryMode: **"This salary mode isn't available for this employment type."** · components: "Add at least one salary component", **"Basic, Housing and Transport are required."**, "Enter a valid amount (≥ 0) for every component", **"Basic salary must be more than 0."**, "A component is selected more than once", "A percentage component cannot exceed 100", **"Select active components only."** · workingHours: "Enter working hours per day (1–24)" (rule: > 0 and ≤ 24) · hourlyRate: "Enter an hourly rate greater than 0" · minHours: "Minimum hours must be ≥ 0" · overtimeRate: **"Overtime rate must be 1–5 in steps of 0.5."** · moduleKey: `APPROVAL_ROUTING_PER_MODULE_DISABLED` (top-level code) |
| Main project change | effectiveFrom: **"Effective date must be after the current main project's start, not in the future and not in a locked period."** |
| Exit (raise, edit terms) | employeeId: "Select a valid employee", "You cannot raise an exit for yourself" (termination only) · exitType: "Please select the exit type" · reasonCategory: "Please select a reason" · reason: "Reason must be 10–1000 characters" · noticeStartDate: "Enter a valid notice start date (within 90 days)" · noticeDays: "Notice period must be 0–180 days" · lastWorkingDay: "Enter a valid last working day", "Last working day must be on/after the notice start date", "Last working day cannot be in the past" (non-owner), "Last working day must be within 365 days of the notice start date" · preferredLastDay: "Preferred last day must be on/after the notice start date" · encashLeave / rehireEligible: "Choose Yes or No" · loanHandling: "Choose how the outstanding loan is handled" · coolingPeriodDays: "Cooling period must be 0–1095 days" |
| Exit withdraw / cancel | reason: "Reason must be 5–500 characters" |
| Exit confirm immediate | reason: "Override reason must be 10–500 characters" |
| Exit settings | noticeDays: "Notice period must be 0–180 days" · coolingPeriodDays: "Cooling period must be 0–1095 days" |
| Rehire | rehireDate: "Enter a valid rehire date", "Rehire date cannot be more than 90 days ahead" · mainProjectId: **"Select an active main project."** · other job fields: as Employee |
