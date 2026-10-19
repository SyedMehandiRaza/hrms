# Issue tracker

Tickets are local markdown files: `docs/tickets/<feature-slug>/<NN>-<slug>.md`, one ticket per file,
numbered from `01` in dependency order (blockers first).

- **Index:** `docs/tickets/README.md` lists every ticket with status and blockers.
- **Ticket shape:** `# NN: Title`, **What to build** (behaviour from the user's side), **Blocked by** (ticket
  numbers/titles or "None (can start immediately)"), **Status**, then acceptance criteria as checkboxes.
- **Status values:** `ready-for-agent` → `in-progress` → `done`. Update the ticket and the index.
- **Frontier:** work any ticket whose blockers are all done.
- **One ticket = one commit:** `<type>(<scope>): <summary> [<feature-slug>#<NN>]`.
- **Acceptance criteria** are user flows with exact messages from `docs/standards.md` §7, including error paths.
  Backend tickets: each criterion is an automated test. UI tickets: each is a `ui-tester` flow, plus lint.
- **Tests before code.** Never delete, skip or weaken a test to make it pass.
- Tickets avoid file paths and code; the plan in `docs/plans/` is the source of truth. If a ticket and the plan
  disagree, stop and ask.
