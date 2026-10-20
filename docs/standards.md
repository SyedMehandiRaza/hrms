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
  404 not found **or belongs to another company**, 409 conflict, 413 body too large, 423 account locked, 429 rate limited,
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

### 7.2 Field messages (`errors` map). **Bold** = new string, add to UI EN + AR.
| Form | Field → messages |
|---|---|
| Login | email: "Email is required", "Invalid email address" · password: "Password is required" |
| Sign up | companyName: "Company name is required", "Company name must be at least 2 characters", **"Company name cannot exceed 100 characters"** · name: "Your name is required", "Name must be at least 2 characters", **"Name cannot exceed 100 characters"** · email: as Login · phone: "Invalid phone number" · password: `AUTH_PASSWORD_WEAK` text · confirmPassword: "Please confirm your password", "Passwords do not match" |
| Forgot | email: as Login |
| Verify OTP | otp: "Please enter complete OTP" |
| Reset / Set / Change password | newPassword: "Password is required", `AUTH_PASSWORD_WEAK` text, `AUTH_PASSWORD_SAME` text · confirmPassword: "Please confirm your password", "Passwords do not match" · currentPassword: "Password is required" |
| Company profile | companyName: "Company name is required", "Company name must be at least 2 characters", **"Company name cannot exceed 100 characters"** · industry: "Please select an industry" · phone: "Phone is required", "Enter a valid phone number (6–15 digits)" · email: "Email is required", "Enter a valid email" · address: "Address is required", **"Address cannot exceed 500 characters"** |
| Time settings | timezone: "Choose a valid timezone" · fy_start_month: "Choose a month from 1 to 12" |
| Department | name: "Department Name is required", "Department Name must be at least 2 characters", "Department Name cannot exceed 150 characters", "Department Name cannot contain emojis" · code: "Dept. Code is required", "Dept. Code cannot exceed 50 characters", "Dept. Code cannot contain emojis" · description: "Description cannot exceed 2000 characters", "Description cannot contain emojis" · deptHeadId: **"Select an active employee of this company."** |
| Designation | name: "Designation Name is required", "Designation Name must be at least 2 characters", "Designation Name cannot exceed 150 characters", "Designation Name cannot contain emojis" · code: "Designation Code cannot exceed 50 characters", "Designation Code cannot contain emojis" · description: as Department |

### 7.3 Contract Studio (added 2026-10-20, plan `docs/plans/contract-studio.md`)
| Code | HTTP | Message |
|---|---|---|
| `CONTRACT_TYPE_NAME_TAKEN` | 409 | A contract type with this name already exists. |
| `CONTRACT_TYPE_CODE_TAKEN` | 409 | A contract type with this code already exists. |
| `CONTRACT_TYPE_IN_USE` | 409 | This contract type is in use and can't be deleted. Deactivate it instead. |
| `CONTRACT_DOCUMENT_INVALID` | 400 | Upload a PDF file up to 20 MB and 50 pages. |
| `CONTRACT_UPLOAD_LIMIT` | 400 | You can upload at most 10 files at a time. |
| `CONTRACT_DOCUMENT_IN_USE` | 409 | This document is used by a template or contract and can't be deleted. Archive it instead. |
| `CONTRACT_DOCUMENT_ARCHIVED` | 409 | This document is archived and can't be used for templates. |
| `CONTRACT_TEMPLATE_IN_USE` | 409 | This template is used by contracts and can't be deleted. Archive it instead. |
| `CONTRACT_TEMPLATE_INACTIVE` | 409 | This template is archived. Choose an active template. |
| `CONTRACT_AUDIENCE_UNSUPPORTED` | 400 | Only Employee and Staffing Company contracts are available right now. |
| `CONTRACT_BULK_LIMIT` | 400 | You can send to at most 200 recipients at a time. |
| `CONTRACT_FIELD_MISSING` | 400 | Some contract values are missing: {{fields}}. |
| `CONTRACT_NO_OPEN_FY` | 409 | There's no open financial year for today. Open one before sending contracts. |
| `CONTRACT_ACTIVE_EXISTS` | 409 | This recipient already has an active contract of this type ({{number}}). Revoke it or wait for it to finish. |
| `CONTRACT_RECIPIENT_INACTIVE` | 409 | This recipient is no longer active. |
| `CONTRACT_STATUS_INVALID` | 409 | This contract can no longer be changed. |
| `CONTRACT_ALREADY_SIGNED` | 409 | You have already signed this contract. |
| `CONTRACT_EXPIRED` | 409 | This contract has expired. Contact HR for a new one. |
| `CONTRACT_REVOKED` | 409 | This contract was withdrawn by HR. |
| `CONTRACT_CONSENT_REQUIRED` | 400 | Please confirm that you agree to sign electronically. |
| `CONTRACT_SELF_APPROVAL` | 403 | You can't approve a contract you signed yourself. |
| `PAYLOAD_TOO_LARGE` | 413 | The request is too large. |

Auto-revoke reason (stored, shown in activity): "Recipient is no longer active."

| Form | Field → messages |
|---|---|
| Contract type | name: "Contract Type Name is required", "Name must be at least 2 characters", "Name cannot exceed 150 characters", "Emojis are not allowed" · code: "Code is required", "Code must be at least 2 characters", "Code cannot exceed 100 characters", "Emojis are not allowed" · description: "Description cannot exceed 500 characters" |
| Document rename | name: **"Document name is required"**, **"Document name cannot exceed 255 characters"** |
| Template | name: "Give the template a name.", **"Template name cannot exceed 255 characters"** · documentId: "Select a source document first." · fields: "Add at least one field or column.", **"Add at least one signature field."**, **"Fields must sit inside the page."**, **"A template can have at most 20 signature and initials fields"**, **"A template can have at most 200 fields"** · field label: **"Label cannot exceed 160 characters"** · contractTypeId: **"Choose a contract type"** · db_column: **"Unknown merge field"** |
| Draft / send | templateId: "Pick a template to continue." · recipientIds: "Select at least one recipient." · name: **"Contract name cannot exceed 255 characters"** · start_date: **"Start date is required"**, "Enter a valid date (YYYY-MM-DD)" · end_date: "Enter a valid date (YYYY-MM-DD)", "End date must be on or after the start date", **"End date can't be in the past"** · renewal_due: "Enter a valid date (YYYY-MM-DD)", **"Renewal due must be between the start and end dates"** · sign_by: **"Sign-by date must be between tomorrow and 90 days from today"** · rate: **"Rate must be a positive amount with up to 2 decimals"** · rate_unit: **"Choose how the rate is paid"** · currency: **"Choose a valid currency"** · notice_period_days: **"Notice period must be 0–365 days"** |
| Sign (submit) | each field id: **"This field is required"**, "Enter a valid date (YYYY-MM-DD)" · input: **"This field cannot exceed 500 characters"**, "Emojis are not allowed" · typed signature: **"Signature must be 2–100 characters"**, "Emojis are not allowed" · typed initials: **"Initials must be 1–10 characters"**, "Emojis are not allowed" · drawn or malformed signature/initials: **"Signature image is invalid or too large"** |
| Reject / Revoke | reason: **"Reason is required"**, **"Reason must be at least 10 characters"**, **"Reason cannot exceed 500 characters"**, "Emojis are not allowed" |
