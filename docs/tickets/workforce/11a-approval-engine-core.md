# 11a: Approval engine core

**What to build:** Any request can be sent through an approval group: levels approve in order, any rejection stops
it, and approvers find what's waiting for them in their inbox (D18, D23–D25, D27 actor columns, D28, D29, D68
approver email).

**Blocked by:** 10 Approval groups API

**Status:** ready-for-agent

Tested through the engine's service with a test entity that supplies its own label and email text (the exit, with
its real text, arrives in 16b).

- [ ] When a request is raised for an employee → it records the employee's group, total levels, current level 1,
      status PENDING and the raiser as a user (`requested_by_user_id`, also when the raiser is the owner); a pending
      log row exists per level-1 approver, and the L1 approvers get the entity's email.
- [ ] When the only mandatory approver at L1 approves → current level moves to 2; L2 approvers get the entity's email.
- [ ] A level with two mandatory approvers moves on only after both approve.
- [ ] A level with no mandatory approvers moves on after any one approves.
- [ ] When the last level approves → status APPROVED, completed time set, the entity's "on approved" hook runs once.
- [ ] When any approver rejects with a reason → status REJECTED, the entity's "on rejected" hook runs; a reason
      shorter than 5 or longer than 500 → 400 `VALIDATION_FAILED`, reason "Reason must be 5–500 characters".
- [ ] A request for an employee with no group → an owner-only request: no member log rows, it shows only in the
      owner's inbox and the owner gets the entity's email.
- [ ] Cancelling a pending request (used by the entity, e.g. exit withdraw) → status CANCELLED, it leaves every inbox,
      past log rows unchanged.
- [ ] The inbox lists only requests at the caller's current level, with type label, employee, dates and level.
- [ ] Changing the group's members updates who can act on current and future levels; past log rows don't change.
- [ ] Requests and inbox are scoped to the company; another company's request → `NOT_FOUND`.
