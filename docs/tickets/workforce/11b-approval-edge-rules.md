# 11b: Approval edge rules

**What to build:** Requests never stall silently and nobody approves their own request: skips, unavailable
approvers, the owner override, group edits while pending and concurrent actions are handled (D22a, D26, D27).

**Blocked by:** 11a Approval engine core

**Status:** ready-for-agent

- [ ] When the subject employee or the raiser is an approver at a level → they're treated as absent there and can't
      act (403 `APPROVAL_NOT_YOUR_TURN` "This request isn't waiting for your approval.").
- [ ] An EXITED approver drops out of every pending level; an IN_NOTICE approver can still approve.
- [ ] A level left with nobody who can act and marked "can skip" → logged SKIPPED automatically, request moves on.
- [ ] Without "can skip" the request stays at that level (blocked) and shows on the owner's inbox.
- [ ] When the owner approves or rejects the current level on someone's behalf with a reason (5–500) → a log row with
      `actor_user_id` = owner and `is_override` = true; no reason → reason "Reason must be 5–500 characters".
- [ ] The owner decides an owner-only request the same way.
- [ ] Changing a group's members re-evaluates its pending requests at once (skip or block as above).
- [ ] A members change that removes a level a pending request is at or still needs → 409 `APPROVAL_GROUP_HAS_PENDING`
      "This group has pending requests. Decide them before removing levels."
- [ ] An approver acting on a request not at their level → 403 `APPROVAL_NOT_YOUR_TURN`.
- [ ] Two approvers deciding the same level at the same time → one wins; the other gets 409 `APPROVAL_ALREADY_DECIDED`
      "This request has already been decided."
- [ ] Acting on an APPROVED, REJECTED or CANCELLED request → 409 `APPROVAL_ALREADY_DECIDED`.
