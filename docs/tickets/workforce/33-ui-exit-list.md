# 33: Exit list

**What to build:** `/admin/exits` lists real exits with the new Pending approval tab (D60).

**Blocked by:** 16b Exit approval outcomes, withdraw, emails

**Status:** done

Verified by the ui-tester agent:

- [x] Tabs with counts: Pending approval, In notice, Exited, Completed (empty for now), Cancelled (including Rejected,
      labelled as such).
- [x] Filters for type, reason and LWD month and search work; columns show employee, type, reason, LWD with days left,
      status.
- [x] A rejected exit shows the rejection reason.
- [x] Rows open the exit detail; hidden without `exit:read`.
- [x] Empty and error states.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.
- API additions, test-first in `backend/tests/exits-raise.test.js`:
  - `GET /exits` `status` takes a comma-separated list.
  - The response has `counts` per status. They follow every filter except the status.
  - Rows carry `reject_reason` and `cancel_reason`.
- The tabs are Pending approval, In notice, Exited, Completed and Cancelled; Cancelled includes Rejected (D60). Rejected rows show "Rejected" and "Reason: …".
- Filters cover type, reason, LWD month and search. In-notice rows show days left.
- The checklist column and the "awaiting confirmation" filter are gone. Checklist and COMPLETED are deferred (D64), and they would only have shown placeholders.
- Without `exit:read`, the page shows the not-allowed state and the sidebar link is hidden. `MODULES.EXIT` was added.
- This commit also carries the raise-exit preview endpoint (`GET /employees/:id/exit-preview`) and its tests, which ticket 32 uses, because the exit service and test file are shared.
