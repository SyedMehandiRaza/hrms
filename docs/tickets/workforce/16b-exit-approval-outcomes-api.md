# 16b: Exit approval outcomes, withdraw, emails

**What to build:** The exit reacts to its approval request: final approval puts the employee in notice, rejection
ends it, the raiser can withdraw it, and the right people are emailed (D59, D68).

**Blocked by:** 16a Raise exit + exit list/detail + exit settings API

**Status:** done

Field texts: `docs/standards.md` §7.2 "Exit withdraw / cancel".

- [x] Final approval with an LWD of today or later → exit and employee IN_NOTICE, exit event APPROVED. (An LWD
      already past is processed by 18's service; that case is tested in 18.)
- [x] Rejection → exit REJECTED with the reason, exit event REJECTED, employee unchanged; a new exit can then be raised.
- [x] Withdraw while pending by the raiser, the owner, or a user with `employee:create` + `employee:update` with a
      reason (5–500) → exit CANCELLED, approval request CANCELLED (gone from every inbox), exit event WITHDRAWN; by
      anyone else → `FORBIDDEN`; no or short reason → reason "Reason must be 5–500 characters".
- [x] Withdrawing an exit that isn't PENDING_APPROVAL → 409 `EXIT_INVALID_STATE`
      "This action isn't possible in the exit's current status."
- [x] Emails: L1 approvers on raise and each later level when reached get "An exit request for {employee} needs your
      approval."; the raiser is emailed on approval and on rejection (with the reason).
- [x] For a termination raised by someone else, the employee gets no email and doesn't see the exit in their own
      views until final approval; they're emailed then. Their own resignation is visible throughout.
- [x] Another company's exit → `NOT_FOUND`.

Notes (2026-10-21):
- `POST /exits/:id/withdraw { reason }` returns 200 with the exit detail. Any company login may call it; the
  service allows the raiser, the owner, or `employee:create` + `employee:update`. The reason is saved as
  `cancel_reason` and on the WITHDRAWN event's payload; past approval logs are kept.
- At final approval the APPROVED event currently has no actor (the engine's hook doesn't pass one).
- Email templates: `exit-approval-needed`, `exit-approved` (raiser), `exit-rejected` (raiser, with the reason),
  `exit-approved-employee` (the leaving employee, when someone else raised the exit — so also a resignation raised
  on their behalf). Only the "needs your approval" text comes from the plan; the other wordings are new, and the
  Arabic needs native review.
- "Their own views" = `GET /exits` and `GET /exits/:id`. A termination raised by someone else is left out of the
  list and gives `NOT_FOUND` on detail for the leaving employee until it has an APPROVED event, so one that's
  rejected or withdrawn stays hidden.
- `hrms_exit_events.created_at` now keeps milliseconds (new migration), so events from different requests in
  the same second come back in timeline order.
- Tests: `backend/tests/exits-outcomes.test.js`. It pins `MAIL_DRIVER=memory` so email assertions don't depend on
  the local `.env`.

Notes (2026-10-21, follow-up): email wording aligned to what the user approved — subjects "Exit request needs your
approval", "Exit request approved", "Exit request rejected", "Your employment is ending"; bodies on one line.
