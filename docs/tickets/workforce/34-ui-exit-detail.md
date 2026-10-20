# 34: Exit detail

**What to build:** `/admin/exits/:id` shows the real exit with its actions: withdraw, edit terms, cancel, confirm
immediate and rehire (D59, D64, D65, D67).

**Blocked by:** 33 Exit list, 17 Exit edit terms, cancel, confirm immediate API, 19 Rehire API

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Exit …" and "Rehire".

Verified by the ui-tester agent:

- [ ] Summary, approval progress by level, LWD history and activity load; checklist and documents panels show an
      empty "coming later" state.
- [ ] Pending approval: the raiser, the owner or a user with employee create + update can Withdraw with a reason →
      Cancelled; reason under 5 characters → "Reason must be 5–500 characters"; others don't see Withdraw.
- [ ] In notice: Edit terms (extend the LWD) → saved; the LWD history shows both dates.
- [ ] Owner sets an LWD in the past → the exit shows Exited right away.
- [ ] In notice: Cancel with a reason → Cancelled and the employee is Active again; reason too short → "Reason must be
      5–500 characters".
- [ ] Owner: Confirm → Immediate with a reason → Exited today; reason under 10 → "Override reason must be 10–500
      characters"; a non-owner doesn't see it.
- [ ] Exited and eligible: Rehire with a date and project → the employee is Active with the same Employee ID.
- [ ] Rehire before the cooling period ends → "This employee isn't eligible for rehire until {date}."; a date more than
      90 days ahead → "Rehire date cannot be more than 90 days ahead"; not eligible → "This employee isn't eligible for
      rehire."
- [ ] Another company's exit → "The requested record was not found."
- [ ] Lint passes.
