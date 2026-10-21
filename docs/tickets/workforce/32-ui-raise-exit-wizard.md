# 32: Raise exit wizard

**What to build:** The Resignation/Termination wizard on Employee Detail submits a real exit for approval (D58–D62,
D65 warnings, D66).

**Blocked by:** 31 Employee detail — overview, Projects tab, Edit modal, resend login; 16a Raise exit + exit
list/detail + exit settings API

**Status:** done

Field texts: `docs/standards.md` §7.2 "Exit (raise, edit terms)".

Verified by the ui-tester agent:

- [x] Step 1 offers the reason lists per type, including Absconding under Termination; reason under 10 characters →
      "Reason must be 10–1000 characters".
- [x] Step 2 defaults notice days from Exit settings and calculates the LWD (0 days → LWD = notice start);
      out-of-range values show their §7.2 messages; a past LWD is accepted only for the owner.
- [x] Step 3 shows the handover warnings (approval groups, pending approvals, departments headed, projects) without
      blocking; settlement shows "Available after Payroll".
- [x] The last button reads "Submit for approval" → toast; the exit shows Pending approval and the employee is still
      Active.
- [x] Raising a second exit → "This employee already has an open exit."
- [x] A sub admin raising a termination on their own profile → "You cannot raise an exit for yourself".
- [x] Hidden for users without both `employee:create` and `employee:update`, and on an exited employee.
- [x] Lint passes.

Notes (2026-10-21, verified): ui-tester checked every criterion in Edge (playwright-core) on this worktree's servers.

- **Defaults and warnings.** The wizard loads `GET /employees/:id/exit-preview`, added with ticket 33's commit and tested in `exits-raise.test.js`.
  - Defaults come from Exit settings: changing notice days to 45 made the wizard default to 45.
  - Step 3 shows the handover warnings: approval groups, pending approvals waiting on the employee, departments headed and projects. Nothing blocks.
- **Settlement.** It shows "Available after Payroll". There is no loan section, since there is no loans module.
- **Reasons.** Absconding is under Termination (D61).
- **Submit.** "Submit for approval" sends `POST /employees/:id/exits`.
  - Toast: "Exit submitted for approval" (new copy). The employee stays Active, and the detail page shows the open-exit banner.
  - Field errors go back to their step. Other errors show inline: "This employee already has an open exit.", "You cannot raise an exit for yourself".
- **Who sees the button.** It needs `employee:create` + update. It is hidden on an exited employee, and while an exit is open when the user can read exits.
