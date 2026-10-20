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
| 24 | [Company Profile screen](auth-company/24-ui-company-profile.md) | done | 14, 10 |
| 25 | [Financial Year tab: timezone + start month](auth-company/25-ui-financial-year-tab.md) | done | 14, 11 |
| 26 | [Departments list screen](auth-company/26-ui-departments-list.md) | done | 14, 12 |
| 27 | [Department detail + designations screen](auth-company/27-ui-department-detail.md) | done | 26, 13 |
| 28 | [Real email delivery over SMTP](auth-company/28-smtp-mailer.md) | done | 03 |

## Countries, cities, phones (`geo/`)

Plan: `docs/plans/countries-cities-phones.md`. ADR 0012 (phones stored as E.164). Builds on Auth + Company (done).
Workforce tickets 03, 04, 13a, 20, 21, 28a are also blocked by geo tickets (shown as `geo NN`). All geo tickets done.

| # | Ticket | Status | Blocked by |
|---|---|---|---|
| 01 | [Schema + country and city reference data](geo/01-schema-reference-data.md) | done | — |
| 02 | [Phone service + data migration](geo/02-phone-service-migration.md) | done | 01 |
| 03 | [Countries and cities API](geo/03-countries-cities-api.md) | done | 01 |
| 04 | [Sign-up and company profile use the new phone rule](geo/04-auth-company-phones.md) | done | 02, 03 |
| 05 | [UI shared Country, City and Phone inputs](geo/05-ui-shared-pickers.md) | done | 03, 04 |

## Workforce structure + Employee lifecycle (`workforce/`)

Plan: `docs/plans/workforce-and-lifecycle.md`. ADRs 0010 (1:1 head office ↔ project), 0011 (one approval group per
employee). Builds on Auth + Company (all done). Senior review 2026-10-20 applied (plan §8). Frontier now: **07, 08, 09, 10, 12, 12b**.

### Backend + tests

| # | Ticket | Status | Blocked by |
|---|---|---|---|
| 01 | [Schema changes](workforce/01-schema-changes.md) | done | — |
| 02 | [Starter salary components](workforce/02-starter-salary-components.md) | done | 01 |
| 03 | [Head offices API](workforce/03-head-offices-api.md) | done | 01, geo 02, geo 03 |
| 04 | [Projects API](workforce/04-projects-api.md) | done | 03, geo 03 |
| 05 | [Project assign / remove API](workforce/05-project-assign-remove-api.md) | done | 04 |
| 06 | [Shifts API + timing history](workforce/06-shifts-api.md) | done | 01 |
| 07 | [Week-offs + copy to next year API](workforce/07-week-offs-copy-api.md) | ready-for-agent | 06 |
| 08 | [Leave types / policies API](workforce/08-leave-types-api.md) | ready-for-agent | 01 |
| 09 | [Salary components API](workforce/09-salary-components-api.md) | ready-for-agent | 02 |
| 10 | [Approval groups API](workforce/10-approval-groups-api.md) | ready-for-agent | 01 |
| 11a | [Approval engine core](workforce/11a-approval-engine-core.md) | ready-for-agent | 10 |
| 11b | [Approval edge rules](workforce/11b-approval-edge-rules.md) | ready-for-agent | 11a |
| 12 | [Employee drafts API](workforce/12-employee-drafts-api.md) | ready-for-agent | 01 |
| 12b | [Roles and staffing-company lookups API](workforce/12b-roles-staffing-lookups-api.md) | ready-for-agent | 01 |
| 13a | [Create employee core](workforce/13a-create-employee-core.md) | ready-for-agent | 04, 10, 12, 12b, geo 02, geo 03 |
| 13b | [At-create setup: leave, shift, salary](workforce/13b-at-create-setup.md) | ready-for-agent | 13a, 06, 08, 09 |
| 14a | [Employee list, detail, bulk (de)activate, resend login API](workforce/14a-employee-list-detail-bulk-api.md) | ready-for-agent | 13b |
| 14b | [Employee edit API](workforce/14b-employee-edit-api.md) | ready-for-agent | 14a |
| 15 | [Main project change API](workforce/15-main-project-change-api.md) | ready-for-agent | 14b |
| 16a | [Raise exit + exit list/detail + exit settings API](workforce/16a-raise-exit-settings-api.md) | ready-for-agent | 11b, 13a |
| 16b | [Exit approval outcomes, withdraw, emails](workforce/16b-exit-approval-outcomes-api.md) | ready-for-agent | 16a |
| 18 | [Last-working-day daily job (+ shared "process exit" service)](workforce/18-lwd-daily-job.md) | ready-for-agent | 16b |
| 17 | [Exit edit terms, cancel, confirm immediate API](workforce/17-exit-terms-cancel-confirm-api.md) | ready-for-agent | 16b, 18 |
| 19 | [Rehire API](workforce/19-rehire-api.md) | ready-for-agent | 18, 13b |

### UI (one ticket per screen, verified by `ui-tester`)

| # | Ticket | Status | Blocked by |
|---|---|---|---|
| 20 | [Head offices screens](workforce/20-ui-head-offices.md) | ready-for-agent | 03, geo 05 |
| 21 | [Projects page, full list, create/edit](workforce/21-ui-projects-list-create.md) | ready-for-agent | 04, geo 05 |
| 22 | [Project detail + assign / remove](workforce/22-ui-project-detail.md) | ready-for-agent | 21, 05 |
| 23 | [Shift list + add/edit, week-offs, copy](workforce/23-ui-shifts.md) | ready-for-agent | 06, 07 |
| 24 | [Leave policy screen](workforce/24-ui-leave-policy.md) | ready-for-agent | 08 |
| 25 | [Salary components screen](workforce/25-ui-salary-components.md) | ready-for-agent | 09 |
| 26 | [Approval groups list, create/edit, view](workforce/26-ui-approval-groups.md) | ready-for-agent | 10 |
| 27 | [Approvals inbox](workforce/27-ui-approvals-inbox.md) | ready-for-agent | 11a, 16b |
| 28a | [Add employee: Basic, Job, Salary + draft](workforce/28a-ui-add-employee-steps.md) | ready-for-agent | 12, 12b, 13b, geo 05 |
| 28b | [Add employee: Review, approval group, create](workforce/28b-ui-add-employee-review-submit.md) | ready-for-agent | 28a, 31 |
| 29 | [Employee drafts tab](workforce/29-ui-employee-drafts.md) | ready-for-agent | 28a |
| 30 | [Employees list](workforce/30-ui-employees-list.md) | ready-for-agent | 14a |
| 31 | [Employee detail, Projects tab, Edit modal, resend login](workforce/31-ui-employee-detail-edit.md) | ready-for-agent | 30, 15 |
| 32 | [Raise exit wizard](workforce/32-ui-raise-exit-wizard.md) | ready-for-agent | 31, 16a |
| 33 | [Exit list](workforce/33-ui-exit-list.md) | ready-for-agent | 16b |
| 34 | [Exit detail](workforce/34-ui-exit-detail.md) | ready-for-agent | 33, 17, 19 |
| 35 | [Settings → Exit settings tab](workforce/35-ui-exit-settings.md) | ready-for-agent | 16a |
| 36 | [End-to-end workforce lifecycle](workforce/36-e2e-workforce-lifecycle.md) | ready-for-agent | all other workforce tickets |
