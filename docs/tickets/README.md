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

## Contract Studio (`contract-studio/`)

Plan: `docs/plans/contract-studio.md`. Only reads Employees/Staffing data (ADR 0008); safe to build in parallel
with the Employees/Termination module. Frontier = every ready-for-agent ticket whose blockers are all done.
Tickets 22–25 were split out of 01, 07, 08 and 10 during review, so number order isn't strict dependency order here:
the **Blocked by** column is the source of truth. Ticket 26 also waits on an **external** blocker: the geo +
workforce branch (`hrms-project-moduleA`) being merged into main (plan section 7).

### Backend + tests

| # | Ticket | Status | Blocked by |
|---|---|---|---|
| 01 | [Contract schema changes](contract-studio/01-schema-changes.md) | ready-for-agent | — |
| 02 | [Contract Studio messages](contract-studio/02-error-catalog.md) | ready-for-agent | — |
| 03 | [Contract types API](contract-studio/03-contract-types-api.md) | ready-for-agent | 01, 02 |
| 04 | [Contract documents API](contract-studio/04-documents-api.md) | ready-for-agent | 01, 02 |
| 05 | [Templates and merge-field catalogue API](contract-studio/05-templates-api.md) | ready-for-agent | 03, 04 |
| 06 | [Recipient lookup API](contract-studio/06-recipient-lookup-api.md) | ready-for-agent | — |
| 07 | [Drafts API (create, edit, delete)](contract-studio/07-drafts-api.md) | ready-for-agent | 05, 06 |
| 22 | [Merge values](contract-studio/22-merge-values.md) | ready-for-agent | 05, 06 |
| 23 | [Contracts list, detail, stats and preview](contract-studio/23-contracts-list-detail-preview.md) | ready-for-agent | 07, 11, 22 |
| 08 | [Send contracts (single and bulk)](contract-studio/08-send-api.md) | ready-for-agent | 07, 22 |
| 09 | [Signer inbox API](contract-studio/09-signer-inbox-api.md) | ready-for-agent | 08, 11 |
| 10 | [Sign (submit)](contract-studio/10-sign-api.md) | ready-for-agent | 09 |
| 24 | [Reject](contract-studio/24-reject-api.md) | ready-for-agent | 09 |
| 11 | [PDF rendering service](contract-studio/11-pdf-rendering.md) | ready-for-agent | 01 |
| 12 | [Approve and revoke](contract-studio/12-approve-revoke-api.md) | ready-for-agent | 10, 11 |
| 13 | [Expiry, reminder and inactive-recipient job](contract-studio/13-expiry-job.md) | ready-for-agent | 08 |
| 14 | [Contract notifications](contract-studio/14-notifications.md) | ready-for-agent | 12, 13, 24 |
| 25 | [Demo contracts seed](contract-studio/25-demo-contracts-seed.md) | ready-for-agent | 12 |
| 26 | [Adapt to the geo + workforce data](contract-studio/26-adapt-to-geo.md) | ready-for-agent | geo + workforce branch merged into main, 06, 11, 22 |

### UI (one ticket per screen)

| # | Ticket | Status | Blocked by |
|---|---|---|---|
| 15 | [Contract Types screen](contract-studio/15-ui-contract-types.md) | ready-for-agent | 03 |
| 16 | [Documents screen](contract-studio/16-ui-documents.md) | ready-for-agent | 04 |
| 17 | [Templates list and builder](contract-studio/17-ui-templates-builder.md) | ready-for-agent | 05, 16 |
| 18 | [Send wizard](contract-studio/18-ui-send-wizard.md) | ready-for-agent | 08, 17 |
| 19 | [Contracts dashboard, list and HR viewer](contract-studio/19-ui-contracts-list-viewer.md) | ready-for-agent | 12, 18, 23 |
| 20 | [My Contracts (Employee panel and admin My Requests)](contract-studio/20-ui-my-contracts-employee.md) | ready-for-agent | 10, 12, 24 |
| 21 | [Staffing portal Contracts page](contract-studio/21-ui-my-contracts-staffing.md) | ready-for-agent | 20 |
