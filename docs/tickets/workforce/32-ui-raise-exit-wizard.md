# 32: Raise exit wizard

**What to build:** The Resignation/Termination wizard on Employee Detail submits a real exit for approval (D58–D62,
D65 warnings, D66).

**Blocked by:** 31 Employee detail — overview, Projects tab, Edit modal, resend login; 16a Raise exit + exit
list/detail + exit settings API

**Status:** ready-for-agent

Field texts: `docs/standards.md` §7.2 "Exit (raise, edit terms)".

Verified by the ui-tester agent:

- [ ] Step 1 offers the reason lists per type, including Absconding under Termination; reason under 10 characters →
      "Reason must be 10–1000 characters".
- [ ] Step 2 defaults notice days from Exit settings and calculates the LWD (0 days → LWD = notice start);
      out-of-range values show their §7.2 messages; a past LWD is accepted only for the owner.
- [ ] Step 3 shows the handover warnings (approval groups, pending approvals, departments headed, projects) without
      blocking; settlement shows "Available after Payroll".
- [ ] The last button reads "Submit for approval" → toast; the exit shows Pending approval and the employee is still
      Active.
- [ ] Raising a second exit → "This employee already has an open exit."
- [ ] A sub admin raising a termination on their own profile → "You cannot raise an exit for yourself".
- [ ] Hidden for users without both `employee:create` and `employee:update`, and on an exited employee.
- [ ] Lint passes.
