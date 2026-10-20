# 27: Approvals inbox

**What to build:** `/employee/approvals` (and the admin's equivalent) lists the requests waiting for the signed-in
approver and lets them approve or reject (D18, D23–D27, D29).

**Blocked by:** 11a Approval engine core, 16b Exit approval outcomes, withdraw, emails

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] An L1 approver sees a pending exit with type "Exit", employee, dates and level; an L2 approver doesn't yet.
- [ ] Approve → it leaves the L1 inbox and appears in the L2 inbox.
- [ ] Reject without a reason → "Reason must be 5–500 characters"; with a reason → it leaves the inbox and the exit
      shows Rejected.
- [ ] Acting on a request someone else already decided → "This request has already been decided."
- [ ] The owner sees blocked and owner-only requests and can approve or reject on someone's behalf with a reason.
- [ ] A withdrawn exit disappears from the inbox.
- [ ] Empty state "nothing waiting"; error state with retry.
- [ ] Lint passes.
