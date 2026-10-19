# 3. Admin-created logins get a temporary password and must change it

Date: 2026-10-19 · Status: Accepted

## Context
Employees, sub-admins and staffing companies are created by an admin, not by sign up. The user wanted
the welcome email to carry the email, a temporary password and a link to set a password, and asked about
a "keep this as your password" option.

## Decision
- The welcome email contains email + temporary password (meets the password rule) + a setup link to the
  Reset Password screen. Both are valid **72 hours**. "Resend" replaces both.
- Setup link → set new password → logged in.
- Logging in with the temporary password works, but every call except change-password and logout returns
  `AUTH_PASSWORD_CHANGE_REQUIRED` until the password is changed. **There is no "keep" option.**
- After 72 h the temporary password fails with `AUTH_SETUP_EXPIRED`.
- If the person already has a password (ADR 2) none is generated; the email says to use it.
- `hrms_staffing_companies.login_enabled` and `must_change_password` are dropped as duplicates of
  `hrms_accounts.status` and `password_setup_required`.

## Consequences
- Follows OWASP / NIST: a password sent by email is treated as exposed and must be replaced at first use.
- Needs a forced change-password modal after login (new UI, approved).
