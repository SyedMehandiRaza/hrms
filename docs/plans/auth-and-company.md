# Plan: Auth + Company setup

Status: **Agreed 2026-10-19** (grilling session, 25 questions + 4 follow-ups). Open questions: **0**.
Rules shared by all modules: `docs/standards.md`. Terms: `docs/CONTEXT.md`. Reasons: `docs/adr/0001`–`0004`.

---

## 1. Decisions

### Shared
1. "SUPER_ADMIN" in the original brief = **ADMIN, the company owner**. No platform super admin for now.
2. **Exactly one ADMIN per company** (`employers.user_id`); all other admin-panel users are SUB_ADMIN.
   Nobody (owner included) can deactivate, suspend, delete or change the access level of the owner's account.
   No ownership transfer, no company deletion via API. Company status is changed by the platform operator only (DB).
3. Permission matrix: section 2.
4. **No setup gate.** Sign up creates a working company: timezone Asia/Riyadh, FY start January, currency SAR,
   current financial year OPEN. Every login goes to its panel's dashboard.
5. Error shape `{ success:false, code, message, errors? }`, `message` by `Accept-Language` (ADR 4).
6. A new company starts with **only the owner**. Sign up creates no roles.
7. An account with no role has every module permission false. Self-service scope for employees is decided
   when RBAC/Employees are planned.

### Auth
8. Email + password. Wrong email and wrong password give the identical response.
9. Login check order: credentials → lock → `users.user_status` → a current, non-suspended account exists
   → company status → temporary-password expiry → success (+ `mustChangePassword`).
10. Lockout: 5 consecutive failures → 15 min. New columns `users.failed_login_attempts INT =0`,
    `users.locked_until DATETIME`. Cleared by a successful login or password reset. Unknown emails are never
    locked. Wrong current password on change-password counts.
11. Rate limits (in-memory `express-rate-limit`): 10/min/IP on login, signup, forgot-password, verify-otp,
    reset-password, setup-password; 60/min/IP on refresh.
12. Access token: JWT 15 min, claims `sub`, `acc`, `emp`, `sid`; Bearer header; UI keeps it in memory only.
    `requireAuth` re-checks session, account and company on every request.
13. Refresh token: 256-bit random, SHA-256 hashed in `hrms_sessions`; httpOnly cookie, `Secure` in prod,
    `SameSite=Strict`, `Path=/auth`; 7 days sliding; rotated on every refresh; reuse of a rotated token
    revokes all the account's sessions.
14. Multiple devices allowed. New column `hrms_sessions.last_used_at`. All sessions are revoked
    automatically on: OTP password reset, refresh-token reuse, deactivation, suspension, exit.
    A role change does not revoke sessions.
15. Session picker: after a password change, a modal lists other sessions with **Select all (checked by
    default)**, per-row checkboxes and "Keep all"; the current session stays. The same list lives
    permanently in Settings → Security & SSO (Admin) and Profile (Employee, Staffing).
16. Logout revokes the current session and clears the cookie; always 200.
17. Password rule: `docs/standards.md` §1 (same on UI and server).
18. Reset by OTP (ADR 1): neutral response, 6 digits, 10 min, 5 attempts, resend after 60 s, max 5/h,
    15-min reset token, revoke all sessions + clear lock on success.
19. Sign up is open. One transaction creates user, company, time settings, first FY and the ADMIN account,
    then logs in. No email verification yet. Email with only ended accounts must enter the existing password;
    a wrong existing password counts toward the login lockout exactly like login (D10: the 5th consecutive wrong
    → 423 `AUTH_ACCOUNT_LOCKED`; while locked → 423 even with the right password; the right password clears the
    count; wrong but not locked → 409 `AUTH_EMAIL_TAKEN`). Emails with a current account → 409, not counted
    (decided 2026-10-19). The optional sign-up phone is stored as the company phone
    (`employers.company_phone_number`).
20. One current company per email (ADR 2).
21. Admin-created logins: temporary password + setup link, 72 h, forced change, no "keep" (ADR 3).
22. Drop `hrms_staffing_companies.login_enabled` and `must_change_password` (duplicates).
23. `GET /auth/me` → `{ user{id,name,email,lang_key}, account{id,access_level,panel},
    company{id,name,logo,timezone,currency}, mustChangePassword, permissions{module:{read,create,update,delete}} }`
    (all true for ADMIN).
24. `POST /auth/change-password { currentPassword, newPassword, confirmPassword }`; clears
    `password_setup_required`; UI then shows the session picker.
25. Mailer service, `console` driver in dev/test, language from `users.lang_key`, tests read an outbox.
26. `hrms_accounts.last_login_at` set on success; failures go to the server log.

### Company
27. Profile = the UI's 6 fields: name, industry, email, phone, address, logo. Deferred: legal name, website,
    tax IDs, company currency (fixed SAR), working days (belong to shift week-offs).
28. Profile validation: name 2–100; industry an existing `industry_types` id; phone digits 6–15; email valid,
    lowercased; address max 500. Name and email not unique. `PUT /company` ADMIN only; `GET /company` any login.
29. Logo: JPG/PNG ≤ 2 MB checked by magic bytes; `PUT` / `DELETE /company/logo`; stored at
    `UPLOAD_DIR/logos/<uuid>.<ext>` behind a storage service, served at `/uploads/...`; old file deleted.
30. `PATCH /company/time-settings` accepts only `timezone` (valid IANA, applies going forward) and
    `fy_start_month` (1–12; locked once any year is CLOSING or CLOSED, locked or not — decided 2026-10-19;
    `fy_start_month_locked` in GET uses the same rule; otherwise re-dates every PLANNED/OPEN year in one
    transaction). Permission: ADMIN or `financial_year:update`.
31. Departments: name 2–150, no emoji, unique per company case-insensitive; **code required**, max 50, no emoji,
    uppercased, unique per company; description max 2000, no emoji; `live_key` lets deleted names/codes be reused;
    head optional, must be an active employee of the company, set NULL when they exit; inactive = not
    assignable, existing employees keep it; delete blocked if any non-deleted employee (incl. exited) points to
    it or its designations, otherwise its designations are soft-deleted with it; list includes stats
    (total/active/inactive), head name and designation count.
32. Designations: name 2–150, no emoji, unique **per department** case-insensitive; code optional, max 50,
    no emoji, uppercased, unique per company; description max 2000; department fixed after creation;
    hidden from assignment if it or its department is inactive; delete blocked by any linked employee
    (incl. exited). Rule for Employees later: an employee's designation must belong to their department.

### How they connect
33. `employer_id` from the token only; another company's IDs → 404; tests include a second company.
34. Role changes apply on the next request; account/company deactivation → 403 `AUTH_ACCOUNT_INACTIVE` /
    `AUTH_COMPANY_INACTIVE` on the next request → UI goes to `/access-ended` (it redirects on the code).
35. After saving profile or logo the UI re-fetches `/auth/me` so the header updates.
36. Last write wins (no version locking).
37. `created_by` / `updated_by` from the token on departments and designations; company profile changes are
    server-logged only.
38. Seeds keep the 4 test users; tests add "Other Co", a temporary-password user and a locked user.

### UI copy changes (approved)
39. Dept. Code stays required (UI). Logo hint → "Upload a JPG or PNG (max 2MB)." Sign-up success toast →
    "Company registered successfully." then go to the dashboard. Company Profile "Too short" →
    "Company name must be at least 2 characters". Add the new max-length strings (section 3) in EN and AR.

### Schema changes needed (migrations)
- `users`: + `failed_login_attempts`, `locked_until`.
- `hrms_sessions`: + `last_used_at`.
- `hrms_staffing_companies`: − `login_enabled`, − `must_change_password`.
- `hrms_departments`: `code` NOT NULL; generated `live_key`; unique `(employer_id, name, live_key)` and
  `(employer_id, code, live_key)`.
- `hrms_designations`: generated `live_key`; unique `(employer_id, department_id, name, live_key)` and
  `(employer_id, code, live_key)`.
- Temporary-password expiry reuses `hrms_accounts.password_setup_token_expires_at`.

### Endpoints
| Method & path | Who |
|---|---|
| `POST /auth/signup` · `/auth/login` · `/auth/refresh` · `/auth/logout` | public / cookie |
| `POST /auth/forgot-password` · `/auth/verify-otp` · `/auth/reset-password` · `/auth/setup-password` | public |
| `POST /auth/change-password` · `GET /auth/me` · `GET /auth/sessions` · `POST /auth/sessions/revoke` | any login |
| `GET /company` | any login |
| `PUT /company` · `PUT /company/logo` · `DELETE /company/logo` | ADMIN |
| `PATCH /company/time-settings` | ADMIN or `financial_year:update` |
| `GET/POST /departments` · `GET/PUT/DELETE /departments/:id` | `department:*` |
| `GET/POST /departments/:id/designations` · `PUT/DELETE /designations/:id` · `GET /designations?departmentId=` | `designation:*` |

Resend of a temporary password/setup link is built with the Employees and Staffing modules.

---

## 2. Permission matrix

| Action | ADMIN (owner) | SUB_ADMIN / EMPLOYEE / GENERAL_EMPLOYEE | STAFFING_COMPANY |
|---|---|---|---|
| Login, refresh, logout, forgot/verify/reset, setup-password, change own password | ✅ | ✅ | ✅ |
| `GET /auth/me`, own sessions list and revoke | ✅ | ✅ | ✅ |
| `GET /company` | ✅ | ✅ | ✅ (own tenant) |
| `PUT /company`, logo upload/remove | ✅ | ❌ | ❌ |
| `PATCH /company/time-settings` | ✅ | `financial_year:update` | ❌ |
| Departments read · create · update · delete | ✅ | `department:read/create/update/delete` | ❌ |
| Designations read · create · update · delete | ✅ | `designation:read/create/update/delete` | ❌ |
| Create a second ADMIN; change the owner's account | ❌ | ❌ | ❌ |
| Change company status, delete company | ❌ (platform only) | ❌ | ❌ |

---

## 3. Messages
All codes and exact texts: `docs/standards.md` §7.

---

## 4. User flows

**Login `/login`**
- Happy: valid → tokens + cookie → `/auth/me` → `/admin/dashboard` | `/employee/dashboard` | `/staffing-company/dashboard`.
- Temporary password: login → forced change-password modal → save → session picker → dashboard.
  Any other call first → `AUTH_PASSWORD_CHANGE_REQUIRED` (modal reopens).
- Errors: field errors · `AUTH_INVALID_CREDENTIALS` · `AUTH_ACCOUNT_LOCKED` (5th failure and while locked) ·
  `AUTH_ACCOUNT_INACTIVE` / `AUTH_COMPANY_INACTIVE` → `/access-ended` · `AUTH_SETUP_EXPIRED` · `RATE_LIMITED`.

**Sign up `/signup`**
- Happy: valid → company + user + account + time settings + first FY → toast "Company registered successfully."
  → logged in → `/admin/dashboard`.
- Errors: field errors · `AUTH_EMAIL_TAKEN` (current account, or ended accounts with a non-matching password) · `RATE_LIMITED`.

**Forgot password `/forgot-password`**
- Happy: email → always `AUTH_RESET_SENT` → `/verify-otp` (code sent only if an eligible account exists).
- Errors: field errors · `AUTH_OTP_RESEND_TOO_SOON` · `RATE_LIMITED`.

**Verify OTP `/verify-otp`**
- Happy: correct code → reset token → `/reset-password`. Resend (after 60 s) → new code, old one void.
- Errors: "Please enter complete OTP" · `AUTH_OTP_INVALID` · `AUTH_OTP_ATTEMPTS_EXCEEDED` (must resend) ·
  no email in state → existing "Email not found…" → back to Forgot.

**Reset password `/reset-password` (reset mode)**
- Happy: valid → saved, all sessions revoked, lock cleared → "Password reset successfully" → `/login`.
- Errors: field errors · `AUTH_PASSWORD_SAME` · `AUTH_RESET_TOKEN_INVALID` → back to Forgot.

**Set password `/reset-password?setup=<token>` (setup mode)**
- Happy: valid → saved, `password_setup_required` cleared → logged in → dashboard.
- Errors: field errors · `AUTH_SETUP_LINK_INVALID`.

**Change password (Profile; also the forced modal)**
- Happy: current + new + confirm → saved → session picker (Select all checked) → revoke chosen or Keep all → toast.
- Errors: field errors · `AUTH_CURRENT_PASSWORD_WRONG` (counts toward lockout; 5th → `AUTH_ACCOUNT_LOCKED` + logout) · `AUTH_PASSWORD_SAME`.

**Active sessions (Settings → Security & SSO; Profile in Employee/Staffing)**
- Happy: list (device, IP, last used, "this device") → select some/all → End sessions → list refreshes.
- Errors: `SESSION_REVOKE_CURRENT` · another user's session → `NOT_FOUND` · empty state "No other active sessions".

**Logout (header menu)**
- Happy: revoke + clear cookie + drop in-memory token → `/login`. Always succeeds.

**Background refresh (any screen)**
- Happy: 401 `AUTH_TOKEN_EXPIRED` → one `/auth/refresh` → retry.
- Errors: refresh fails → `/login` · reuse detected → all sessions revoked → `/login` · deactivated → `/access-ended`.

**Company Profile (Settings → Company Profile)**
- Happy: `GET /company` → edit → Save → confirm → `PUT /company` → "✓ Saved" → `/auth/me` refresh → header updates.
  Discard resets to last saved. Logo: pick → `PUT /company/logo` → preview + header; Remove → confirm → `DELETE`.
- Errors: field errors · `COMPANY_LOGO_INVALID` · not owner → read-only, API `FORBIDDEN` · load failure → error state + retry.

**Financial Year tab (timezone + start month only)**
- Happy: change → Save → PLANNED/OPEN years re-dated → success.
- Errors: `COMPANY_TIMEZONE_INVALID` · `COMPANY_FY_START_INVALID` · `COMPANY_FY_START_LOCKED` (field disabled) ·
  no permission → read-only, API `FORBIDDEN`.

**Departments `/admin/departments`**
- Happy: list with stats, search, status filter, pagination → Create/Edit modal → save → toast → refresh →
  Delete → confirm → removed with its designations.
- Errors: field errors · `DEPARTMENT_NAME_TAKEN` / `DEPARTMENT_CODE_TAKEN` · head field error ·
  `DEPARTMENT_IN_USE` · no permission → buttons hidden, API `FORBIDDEN` · empty and error states.

**Department detail + designations `/admin/departments/:id`**
- Happy: info + designation list → Create/Edit modal → save → Delete → confirm.
- Errors: unknown/other tenant → `NOT_FOUND` · field errors · `DESIGNATION_NAME_TAKEN` / `DESIGNATION_CODE_TAKEN` ·
  `DESIGNATION_IN_USE` · `FORBIDDEN` · empty state.

**Access ended `/access-ended`**
- Shows the message; "Back to sign in" clears the local session.

---

## 5. Open questions
None.
