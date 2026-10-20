# 7. Contracts use a one-click HR approval, not the Approval Groups workflow

Date: 2026-10-20 · Status: Accepted

## Context
After the signer submits, the employer signs off. `hrms_contracts.approval_request_id` could route this through
the Approval Groups module, which is built in another session. The status enum has both APPROVED and COMPLETED, and
no REVOKED.

## Decision
- SUBMITTED → COMPLETED by one click from anyone with `contract:update`; nobody may approve a contract they signed.
- APPROVED stays in the enum but is unused; REVOKED (with a reason) is added and allowed from SENT, VIEWED and
  SUBMITTED.
- `approval_request_id` stays NULL.

## Consequences
- Contract Studio ships without depending on Approval Groups.
- Multi-level contract approval can be added later by using `approval_request_id`.
