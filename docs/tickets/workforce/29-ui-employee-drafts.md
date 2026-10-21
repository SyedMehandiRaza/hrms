# 29: Employee drafts tab

**What to build:** The Drafts tab on `/admin/employees` lists real drafts with resume and delete (D53).

**Blocked by:** 28a Add employee wizard — Basic, Job, Salary + save draft

**Status:** done

Verified by the ui-tester agent:

- [x] Drafts show name (or "Untitled"), progress, last saved and saved by; a draft saved by another admin appears too.
- [x] Resume opens the wizard at the saved step with the saved values.
- [x] Delete → confirm → gone.
- [x] Empty state; hidden without `employee:create`.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.
- The Drafts tab reads `GET /employee-drafts` (newest saved first, shared within the company).
- It shows name (or "Untitled draft"), email, step progress, last saved and saved by. Search filters by name and email.
- Resume opens the wizard at the saved step with the saved values. Delete uses `DELETE /employee-drafts/:id`. The empty state shows when there are no drafts.
- Hidden without `employee:create`, checked with a mocked role.
