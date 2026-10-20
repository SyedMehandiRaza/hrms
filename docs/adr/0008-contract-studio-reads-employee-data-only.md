# 8. Contract Studio only reads employee and staffing data

Date: 2026-10-20 · Status: Accepted

## Context
Employees / Termination and Staffing are built by other developers in parallel and merged later. Contract Studio
needs employee and staffing-company data for recipients, merge fields, visibility and inactive checks.

## Decision
- Contract Studio reads `employees`, `hrms_accounts`, `users`, `hrms_staffing_companies` and lookups, and
  references them by id. It never writes them, never calls their APIs and never hooks into Termination.
- It has its own read-only recipient lookup (`GET /contract-recipients`).
- Recipients that leave are handled by reading status: blocked at send, auto-revoked by the hourly job, refused on
  every action.
- Signatures are stored on the contract only; profile signature columns are not written.
- Schema changes touch only the eight contract tables.

## Consequences
- Clean merge: no shared files with the Employees branch except models it reads.
- Exits are noticed within an hour (job) or immediately on any action, not instantly by event.
