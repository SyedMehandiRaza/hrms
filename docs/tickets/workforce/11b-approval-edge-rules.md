# 11b: Approval edge rules

**What to build:** Requests never stall silently and nobody approves their own request: skips, unavailable
approvers, the owner override, group edits while pending and concurrent actions are handled (D22a, D26, D27).

**Blocked by:** 11a Approval engine core

**Status:** done

- [x] When the subject employee or the raiser is an approver at a level → they're treated as absent there and can't
      act (403 `APPROVAL_NOT_YOUR_TURN` "This request isn't waiting for your approval.").
- [x] An EXITED approver drops out of every pending level; an IN_NOTICE approver can still approve.
- [x] A level left with nobody who can act and marked "can skip" → logged SKIPPED automatically, request moves on.
- [x] Without "can skip" the request stays at that level (blocked) and shows on the owner's inbox.
- [x] When the owner approves or rejects the current level on someone's behalf with a reason (5–500) → a log row with
      `actor_user_id` = owner and `is_override` = true; no reason → reason "Reason must be 5–500 characters".
- [x] The owner decides an owner-only request the same way.
- [x] Changing a group's members re-evaluates its pending requests at once (skip or block as above).
- [x] A members change that removes a level a pending request is at or still needs → 409 `APPROVAL_GROUP_HAS_PENDING`
      "This group has pending requests. Decide them before removing levels."
- [x] An approver acting on a request not at their level → 403 `APPROVAL_NOT_YOUR_TURN`.
- [x] Two approvers deciding the same level at the same time → one wins; the other gets 409 `APPROVAL_ALREADY_DECIDED`
      "This request has already been decided."
- [x] Acting on an APPROVED, REJECTED or CANCELLED request → 409 `APPROVAL_ALREADY_DECIDED`.

Notes (2026-10-21): rules live in `backend/src/services/approval.service.js` (`settle`, `skippable`, `reevaluate`,
`reevaluateGroup`). "Can skip" means every approver at the level is marked Can skip (D26). The owner's override is
`POST /approvals/:id/approve|reject { reason }`, and the owner's inbox flags blocked requests with `blocked: true`.
`approvalGroup.service` members hooks: a guard before the change (APPROVAL_GROUP_HAS_PENDING) and a re-evaluation after it.
Tests: `backend/tests/approval-edge-rules.test.js`.
