# 33: Exit list

**What to build:** `/admin/exits` lists real exits with the new Pending approval tab (D60).

**Blocked by:** 16b Exit approval outcomes, withdraw, emails

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] Tabs with counts: Pending approval, In notice, Exited, Completed (empty for now), Cancelled (including Rejected,
      labelled as such).
- [ ] Filters for type, reason and LWD month and search work; columns show employee, type, reason, LWD with days left,
      status.
- [ ] A rejected exit shows the rejection reason.
- [ ] Rows open the exit detail; hidden without `exit:read`.
- [ ] Empty and error states.
- [ ] Lint passes.
