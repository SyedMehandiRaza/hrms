# 14: Contract notifications

**What to build:** In-app notification rows and emails for contract events (plan decision 43). Showing them in the
header bell isn't part of this ticket.

**Blocked by:** 12 Approve and revoke, 13 Expiry, reminder and inactive-recipient job, 24 Reject

**Status:** done

- [x] When HR sends a contract → the signer (the employee's user, or the staffing company's user) gets a
      notification row and an email.
- [x] When the signer submits → the contract's creator is notified.
- [x] When the signer rejects → the creator is notified, with the reason.
- [x] When the job records a 2-day reminder → the signer is notified, once.
- [x] When the job expires a contract → the creator and the signer are notified.
- [x] When HR revokes → the signer is notified, with the reason; when the job auto-revokes → only the creator is notified.
- [x] When HR approves → the signer is notified that the final PDF is ready.
- [x] When each event happens → the row's type, title and body, and the email's subject and body, match the plan's
      notification table exactly (e.g. "New contract to sign" / "Employment Contract (CON-2026-0001) is waiting for
      your signature. Sign by 27 Oct 2026."), with an "Open contract" button.
- [x] When a notification is created → the row has entity "contract" and the contract id; the email is in the
      receiver's language, appears in the test outbox and contains no PDF or merge/field values.
- [x] When the email links to the contract → it is APP_URL plus `/employee/my-contracts` (employee),
      `/admin/my-requests/contracts` (owner or sub-admin signer), `/staffing-company/contracts` (staffing company) or
      `/admin/new-contracts` (creator), followed by `?contract=<id>`.
- [x] When the creator no longer has a current account → nothing is sent to them, and the action still succeeds.
- [x] When sending the email fails → the action that triggered it stays done, and the failure is logged.
