# Tickets

Conventions: `docs/agents/issue-tracker.md`. Exact messages: `docs/standards.md` §7.

## Auth + Company setup (`auth-company/`)

Plan: `docs/plans/auth-and-company.md`. **Company tickets (10–13, 24–27) are blocked by Auth (04, plus 14 for UI).**
Frontier = every ready-for-agent ticket whose blockers are all done.

### Backend + tests

| # | Ticket | Status | Blocked by |
|---|---|---|---|
| 01 | [Error catalog and response shape](auth-company/01-error-catalog.md) | done | — |
| 02 | [Schema changes](auth-company/02-schema-changes.md) | done | — |
| 03 | [Mailer](auth-company/03-mailer.md) | done | — |
| 04 | [Login, refresh, logout, current user, permission guard](auth-company/04-login-refresh-logout.md) | done | 01, 02 |
| 05 | [Lockout and rate limits](auth-company/05-lockout-rate-limits.md) | done | 04 |
| 06 | [Sign up](auth-company/06-signup.md) | done | 04 |
| 07 | [Forgot password, verify code, reset](auth-company/07-forgot-reset-otp.md) | done | 03, 04 |
| 08 | [Temporary password, setup link, forced change](auth-company/08-temporary-password.md) | done | 03, 04 |
| 09 | [Change password and sessions](auth-company/09-change-password-sessions.md) | done | 04 |
| 10 | [Company profile and logo API](auth-company/10-company-profile-api.md) | done | 04 (Auth) |
| 11 | [Time settings API](auth-company/11-time-settings-api.md) | done | 04 (Auth) |
| 12 | [Departments API](auth-company/12-departments-api.md) | done | 02, 04 (Auth) |
| 13 | [Designations API](auth-company/13-designations-api.md) | done | 12 |

### UI (one ticket per screen)

| # | Ticket | Status | Blocked by |
|---|---|---|---|
| 14 | [UI foundation: API client, session, guards, permissions](auth-company/14-ui-foundation.md) | done | 04 |
| 15 | [Login screen](auth-company/15-ui-login.md) | done | 14, 05 |
| 16 | [Sign up screen](auth-company/16-ui-signup.md) | done | 14, 06 |
| 17 | [Forgot password screen](auth-company/17-ui-forgot-password.md) | done | 14, 07 |
| 18 | [Verify OTP screen](auth-company/18-ui-verify-otp.md) | done | 17 |
| 19 | [Reset / Set password screen](auth-company/19-ui-reset-set-password.md) | done | 18, 08 |
| 20 | [Forced change-password modal](auth-company/20-ui-forced-change-modal.md) | done | 15, 08, 21 |
| 21 | [Profile → Change password + session picker](auth-company/21-ui-change-password-picker.md) | done | 14, 09 |
| 22 | [Active sessions list](auth-company/22-ui-active-sessions.md) | done | 21 |
| 23 | [Header logout + Access ended](auth-company/23-ui-logout-access-ended.md) | done | 14 |
| 24 | [Company Profile screen](auth-company/24-ui-company-profile.md) | in-progress | 14, 10 |
| 25 | [Financial Year tab: timezone + start month](auth-company/25-ui-financial-year-tab.md) | ready-for-agent | 14, 11 |
| 26 | [Departments list screen](auth-company/26-ui-departments-list.md) | ready-for-agent | 14, 12 |
| 27 | [Department detail + designations screen](auth-company/27-ui-department-detail.md) | ready-for-agent | 26, 13 |
