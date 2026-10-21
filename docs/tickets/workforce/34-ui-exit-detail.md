# 34: Exit detail

**What to build:** `/admin/exits/:id` shows the real exit with its actions: withdraw, edit terms, cancel, confirm
immediate and rehire (D59, D64, D65, D67).

**Blocked by:** 33 Exit list, 17 Exit edit terms, cancel, confirm immediate API, 19 Rehire API

**Status:** done

Field texts: `docs/standards.md` §7.2 "Exit …" and "Rehire".

Verified by the ui-tester agent:

- [x] Summary, approval progress by level, LWD history and activity load; checklist and documents panels show an
      empty "coming later" state.
- [x] Pending approval: the raiser, the owner or a user with employee create + update can Withdraw with a reason →
      Cancelled; reason under 5 characters → "Reason must be 5–500 characters"; others don't see Withdraw.
- [x] In notice: Edit terms (extend the LWD) → saved; the LWD history shows both dates.
- [x] Owner sets an LWD in the past → the exit shows Exited right away.
- [x] In notice: Cancel with a reason → Cancelled and the employee is Active again; reason too short → "Reason must be
      5–500 characters".
- [x] Owner: Confirm → Immediate with a reason → Exited today; reason under 10 → "Override reason must be 10–500
      characters"; a non-owner doesn't see it.
- [x] Exited and eligible: Rehire with a date and project → the employee is Active with the same Employee ID.
- [x] Rehire before the cooling period ends → "This employee isn't eligible for rehire until {date}."; a date more than
      90 days ahead → "Rehire date cannot be more than 90 days ahead"; not eligible → "This employee isn't eligible for
      rehire."
- [x] Another company's exit → "The requested record was not found."
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.

- **API addition.** `GET /exits/:id` gained `approval`, tested in `exits-outcomes.test.js`:
  - the request's status, current and total levels
  - each level's approvers, decisions and state (APPROVED / REJECTED / SKIPPED / PENDING / WAITING)
  - owner-only requests list their decisions at the top level.
- **The page** reads the detail. The checklist and documents panels show "Coming in a later release.", and the settlement panel shows "Available after Payroll". All three are deferred (D62, D64).
- **Actions:**
  - Withdraw (pending): the raiser, the owner, or `employee:create` + update.
  - Edit terms and Cancel (in notice): `employee:create` + update. The notice start can't change.
  - Confirm → Immediate (in notice): owner only, with a reason of 10–500 characters. The modal now offers only this (D64).
  - Rehire (exited, not yet rehired): `employee:create`. The server checks the cooling period and eligibility; the messages show under the date.
- **Unknown or another company's id.** The page shows the server's "The requested record was not found.". Only unknown and malformed ids were tested, since no other company's data was available.
- **New copy (needs review):** the Withdraw modal texts, "Confirm → Immediate", the approval panel labels and "Coming in a later release.".
- **Known limits:**
  - An LWD moved earlier still shows as "Last working day extended" in the history, because the API has one event type.
  - The cooling date in the server message is ISO.
