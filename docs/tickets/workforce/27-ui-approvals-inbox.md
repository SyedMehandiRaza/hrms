# 27: Approvals inbox

**What to build:** `/employee/approvals` (and the admin's equivalent) lists the requests waiting for the signed-in
approver and lets them approve or reject (D18, D23–D27, D29).

**Blocked by:** 11a Approval engine core, 16b Exit approval outcomes, withdraw, emails

**Status:** done

Verified by the ui-tester agent:

- [x] An L1 approver sees a pending exit with type "Exit", employee, dates and level; an L2 approver doesn't yet.
- [x] Approve → it leaves the L1 inbox and appears in the L2 inbox.
- [x] Reject without a reason → "Reason must be 5–500 characters"; with a reason → it leaves the inbox and the exit
      shows Rejected.
- [x] Acting on a request someone else already decided → "This request has already been decided."
- [x] The owner sees blocked and owner-only requests and can approve or reject on someone's behalf with a reason.
- [x] A withdrawn exit disappears from the inbox.
- [x] Empty state "nothing waiting"; error state with retry.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked the flows in Edge (playwright-core) on this worktree's servers.
- The employee inbox (/employee/approvals) and the admin Dashboard Action Center (the owner's and admins' inbox) read `GET /approvals/inbox`. Both show an error state with Retry.
- L1→L2 approve was checked, and so were reject reason rules (5–500) and the "already decided" 409. A withdrawn exit leaves the inbox.
- Owner on-behalf decisions need a reason. These were checked on blocked requests only. An owner-only request (no group) can't be created in the dev data, because creation needs a group once one exists. It uses the same modal path.
- Fixed after the first pass: Retry on the Action Center, the inbox subtitle ("Requests waiting for your approval."), and readable type labels.
- The approvals locales are committed here with the approval-group screen keys (26) and the routing hint wording (D51).
