# 29: Employee drafts tab

**What to build:** The Drafts tab on `/admin/employees` lists real drafts with resume and delete (D53).

**Blocked by:** 28a Add employee wizard — Basic, Job, Salary + save draft

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] Drafts show name (or "Untitled"), progress, last saved and saved by; a draft saved by another admin appears too.
- [ ] Resume opens the wizard at the saved step with the saved values.
- [ ] Delete → confirm → gone.
- [ ] Empty state; hidden without `employee:create`.
- [ ] Lint passes.
