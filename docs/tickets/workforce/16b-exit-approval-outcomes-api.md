# 16b: Exit approval outcomes, withdraw, emails

**What to build:** The exit reacts to its approval request: final approval puts the employee in notice, rejection
ends it, the raiser can withdraw it, and the right people are emailed (D59, D68).

**Blocked by:** 16a Raise exit + exit list/detail + exit settings API

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Exit withdraw / cancel".

- [ ] Final approval with an LWD of today or later → exit and employee IN_NOTICE, exit event APPROVED. (An LWD
      already past is processed by 18's service; that case is tested in 18.)
- [ ] Rejection → exit REJECTED with the reason, exit event REJECTED, employee unchanged; a new exit can then be raised.
- [ ] Withdraw while pending by the raiser, the owner, or a user with `employee:create` + `employee:update` with a
      reason (5–500) → exit CANCELLED, approval request CANCELLED (gone from every inbox), exit event WITHDRAWN; by
      anyone else → `FORBIDDEN`; no or short reason → reason "Reason must be 5–500 characters".
- [ ] Withdrawing an exit that isn't PENDING_APPROVAL → 409 `EXIT_INVALID_STATE`
      "This action isn't possible in the exit's current status."
- [ ] Emails: L1 approvers on raise and each later level when reached get "An exit request for {employee} needs your
      approval."; the raiser is emailed on approval and on rejection (with the reason).
- [ ] For a termination raised by someone else, the employee gets no email and doesn't see the exit in their own
      views until final approval; they're emailed then. Their own resignation is visible throughout.
- [ ] Another company's exit → `NOT_FOUND`.
