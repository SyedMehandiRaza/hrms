# 2. One current company per email

Date: 2026-10-19 · Status: Accepted

## Context
`hrms_accounts` is unique on (user, company), so one person could have logins in several tenants.
Login takes only email + password and there's no company-picker screen. People also move between
companies: someone terminated by one company may be hired by another with the same email.

## Decision
- A person may have only one **current** account (status ACTIVE or SUSPENDED) across all companies.
  Creating another one anywhere returns `ACCOUNT_EMAIL_IN_OTHER_COMPANY` (409).
- **Ended** accounts (INACTIVE or soft-deleted, e.g. after an exit) don't block. The new company gets a new
  `hrms_accounts` row on the same `users` row. Company data never crosses tenants.
- Login resolves the single current account. Only ended accounts → `AUTH_ACCOUNT_INACTIVE` (`/access-ended`).
- Rehire into the same company reactivates the old account.
- Sign up with an email that only has ended accounts must enter that person's existing password.
- If the person already has a password, no temporary password is generated when a new company adds them.

## Consequences
- No migration needed. A company switcher (several current accounts) can be added later.
