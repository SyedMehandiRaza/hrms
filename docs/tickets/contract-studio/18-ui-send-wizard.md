# 18: Send wizard

**What to build:** `/admin/new-contracts/create` creates drafts or sends for real: two live audiences, the
recipient picker, the new term fields, Save as draft and a per-recipient result summary (plan decisions 18–25, 45).

**Blocked by:** 08 Send contracts (single and bulk), 17 Templates list and builder

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] When HR opens the wizard → Vendor, Client and Collaborator cards are disabled and tagged "Coming soon";
      Employee and Staffing Company can be picked.
- [ ] When HR continues without a template → "Pick a template to continue."; without recipients → "Select at least
      one recipient."
- [ ] When HR filters recipients by project or staffing company, or searches → the list comes from the API; inactive
      recipients show as inactive.
- [ ] When HR looks at a selected recipient → the role dropdown shows "Primary Signer" and is disabled; the
      signing-order toggle is disabled.
- [ ] When HR reaches Terms → Start, End, Renewal due, Sign by (pre-filled with today + 7), Rate, Rate unit,
      Currency (SAR), Notice period; each §7.3 "Draft / send" error appears under its input.
- [ ] When HR sends to 3 valid employees → "3 sent, 0 saved as draft" → the contracts list shows 3 Sent contracts
      with CON numbers.
- [ ] When HR sends to 3 employees, one of whom has an active contract of that type → "2 sent, 1 saved as draft"
      with that name and "This recipient already has an active contract of this type (CON-…). Revoke it or wait for
      it to finish."
- [ ] When HR clicks "Save as draft" → the contracts appear in the Drafts tab with no number.
- [ ] When HR double-clicks Send or "Save as draft" → only one request is made (the button is disabled while it
      runs).
- [ ] When a row fails unexpectedly → the summary ends with ", 1 failed" and lists that name with "Something went
      wrong. Please try again."; with no failures the summary has no "failed" part.
- [ ] When lint runs → it passes.
