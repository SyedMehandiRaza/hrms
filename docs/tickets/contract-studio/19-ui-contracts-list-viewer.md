# 19: Contracts dashboard, list and HR viewer

**What to build:** `/admin/new-contracts/dashboard` and `/admin/new-contracts` show real stats and contracts; the
viewer shows the PDF with values, recipient status and activity, with draft Edit/Send/Delete, Revoke and Approve
(plan decisions 22, 33–34, 39, 42, 45).

**Blocked by:** 12 Approve and revoke, 18 Send wizard, 23 Contracts list, detail, stats and preview

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] When HR opens the dashboard and list → the stats and status tabs match the data; search and pagination work.
- [ ] When HR opens a draft → the PDF shows live values; Edit terms saves → "Draft updated"; Send → it moves to
      Sent with a CON number; Delete → "Draft deleted" and it disappears.
- [ ] When HR revokes a Sent contract → a reason dialog (with the §7.3 "Reject / Revoke" errors) → "Contract
      revoked" → Revoked, and the activity shows the reason.
- [ ] When HR approves a Submitted contract → "Contract approved" → Completed → Download gives the final PDF ending
      with the certificate page.
- [ ] When HR approves a contract they signed themselves → "You can't approve a contract you signed yourself."
- [ ] When HR acts on a contract that changed elsewhere (e.g. already revoked) → the server message shows and the
      contract reloads with its real status.
- [ ] When HR downloads a contract that isn't completed → the PDF carries the "Not final" watermark.
- [ ] When a sub-admin without `contract:read` logs in → no Contract Studio items in the sidebar; with read only →
      no create, edit, send, revoke, approve or delete buttons.
- [ ] When HR opens `/admin/new-contracts?contract=<id>` (the email link) → that contract opens in the viewer.
- [ ] When lint runs → it passes.
