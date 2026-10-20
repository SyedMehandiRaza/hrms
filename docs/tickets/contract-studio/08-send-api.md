# 08: Send contracts (single and bulk)

**What to build:** Sending from the wizard or from a draft: CON number, values frozen, sign-by expiry, the
one-active-contract rule, inactive recipients, partial bulk results (plan decisions 23–25, 35, 41). Resolving and
formatting merge values is ticket 22.

**Blocked by:** 07 Drafts API, 22 Merge values

**Status:** done

- [x] When HR sends to 3 valid employees in FY 2026 → 3 SENT contracts numbered CON-2026-0001, -0002 and -0003, each
      with merge values frozen, a sent time, expiry at the end of the sign-by day in company time and a SENT
      activity; the response lists all 3 as SENT.
- [x] When HR sends an existing draft → it becomes SENT with the next number.
- [x] When a contract is sent → its stored values hash equals the shared recipe recomputed from its merge values.
- [x] When the template has `contract_no` and `sent_date` merge fields → the sent contract shows its own number and
      today's date (company time).
- [x] When the employee's designation changes after send → the sent contract still shows the old designation.
- [x] When HR sends a draft created a week ago → the employee's current values are frozen at send time.
- [x] When a required merge field has no value (e.g. no designation) → that contract stays DRAFT / "Some contract
      values are missing: Designation."; the others are still sent.
- [x] When the employee has no active main project → the contract has no project; a required `project` merge field
      keeps it DRAFT / "Some contract values are missing: Project."; an optional one sends with it blank.
- [x] When the recipient already has a SENT, VIEWED or SUBMITTED contract of the same type → that contract stays
      DRAFT / "This recipient already has an active contract of this type (CON-2026-0001). Revoke it or wait for it
      to finish."
- [x] When the recipient only has a COMPLETED contract of the same type → the send succeeds.
- [x] When two HR users send to the same recipient and type at the same moment → exactly one becomes SENT.
- [x] When the employee is exited or deleted, or their account has ended → that contract stays DRAFT / "This
      recipient is no longer active."
- [x] When the staffing company is inactive, has no login, or its login's account in this company has ended → that
      contract stays DRAFT / "This recipient is no longer active."
- [x] When the employee is IN_NOTICE, or the recipient's account is suspended → the send succeeds.
- [x] When some recipients are blocked → the response (201) lists each one as DRAFT with its code and message, with
      `sent`, `drafts` and `failed` counts, and the blocked draft keeps the reason.
- [x] When one recipient hits an unexpected error → that row is "FAILED" / "Something went wrong. Please try
      again." with no contract created, and the other recipients are still processed.
- [x] When one recipient id doesn't exist, belongs to another company, or is from the other audience → 404 / "The
      requested record was not found." and no contract is created for anyone.
- [x] When the same recipient id is sent twice → one contract is created for it.
- [x] When HR sends a single blocked draft → its error (e.g. 409 / "This recipient is no longer active."), it stays
      DRAFT with the new reason; when a later send succeeds → the stored reason is cleared.
- [x] When many sends run at once → no two contracts share a number; when a send fails → its number isn't used up.
- [x] When two sends run at once and both are the first contract of the financial year → both succeed with
      different numbers.
- [x] When no financial year includes today, or the one that does is planned, closing or closed → 409 / "There's
      no open financial year for today. Open one before sending contracts.", and no drafts are created.
- [x] When a draft's end date has passed by send time → "End date can't be in the past"; when its sign-by date is
      no longer between tomorrow and +90 days → "Sign-by date must be between tomorrow and 90 days from today".
- [x] When the draft's template has been archived since → the send still works (the contract has its own copy).
- [x] When HR sends from an ACTIVE template whose document has been archived → the send works.
- [x] When HR sends a non-draft → 409 / "This contract can no longer be changed."
- [x] When one HR user sends a draft while another edits it at the same moment → either the edit lands first and is
      the version sent, or the send lands first and the edit gets 409 / "This contract can no longer be changed."
- [x] When one HR user sends a draft while another deletes it → exactly one wins; the loser gets 409 / "This contract
      can no longer be changed." (send lost to delete: 404 / "The requested record was not found.").
- [x] When HR sends another company's draft → 404 / "The requested record was not found."
- [x] When a sub-admin without `contract:create` sends → 403 / "You don't have permission to do this."
- [x] When a send succeeds → no employee, account or staffing-company row is changed.
