# 12: Approve and revoke

**What to build:** HR one-click approval producing the final PDF, and revoke with a reason (plan decisions 33–34,
37, ADR 0007).

**Blocked by:** 10 Sign (submit), 11 PDF rendering service

**Status:** ready-for-agent

- [ ] When HR approves a SUBMITTED contract → it becomes COMPLETED with approver, approved and completed times;
      the final PDF is stored privately with its SHA-256 on the contract; a COMPLETED activity is logged.
- [ ] When PDF generation fails during approval → 500 / "Something went wrong. Please try again." and the contract
      stays SUBMITTED with nothing stored.
- [ ] When saving fails after the final PDF was written (forced in the test) → 500, the contract stays SUBMITTED and
      no PDF file is left behind.
- [ ] When two approvals run at once → only one final PDF file exists afterwards.
- [ ] When HR approves a contract signed by their own employee record → 403 / "You can't approve a contract you
      signed yourself." (the owner too).
- [ ] When HR approves a contract that isn't SUBMITTED (including a revoked or expired one) → 409 / "This contract
      can no longer be changed."
- [ ] When HR approves a revoked contract they signed themselves → 409 / "This contract can no longer be changed."
      (state is checked before self-approval).
- [ ] When two approvals run at once → exactly one succeeds; the other gets 409 / "This contract can no longer be changed."
- [ ] When the signer has become inactive → 409 / "This recipient is no longer active."
- [ ] When HR revokes a SENT, VIEWED or SUBMITTED contract with a 10–500 character reason → it becomes REVOKED with
      the reason, time and revoker, and a REVOKED activity is logged.
- [ ] When HR revokes a DRAFT, COMPLETED, REJECTED, EXPIRED or REVOKED contract → 409 / "This contract can no
      longer be changed."
- [ ] When HR revokes a SENT contract whose sign-by time has passed (before the job runs) → 409 / "This contract
      can no longer be changed.", and it is now EXPIRED.
- [ ] When the revoke reason is missing → "Reason is required"; 9 characters → "Reason must be at least 10
      characters"; 501 → "Reason cannot exceed 500 characters"; an emoji → "Emojis are not allowed".
- [ ] When HR sends a new contract of the same type to that recipient after revoking → the send succeeds.
- [ ] When a sub-admin without `contract:update` approves or revokes → 403 / "You don't have permission to do this."
- [ ] When HR approves or revokes another company's contract → 404 / "The requested record was not found."
