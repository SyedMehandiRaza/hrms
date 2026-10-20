# 20: My Contracts (Employee panel and admin My Requests)

**What to build:** `/employee/my-contracts` and `/admin/my-requests/contracts` list the person's own contracts and
let them view, sign with consent, reject with a reason and download (plan decisions 26–32, 45).

**Blocked by:** 10 Sign (submit), 12 Approve and revoke, 24 Reject

**Status:** done

Verified by the ui-tester agent:

- [x] When the employee opens My Contracts → only their contracts, pending first.
- [x] When the employee opens a Sent contract → its status becomes Viewed.
- [x] When required fields are empty → Submit is disabled with "{{count}} required field(s) still need completing."
- [x] When the employee opens the typed signature → it is pre-filled with their profile name and can be edited.
- [x] When the employee draws or types a signature, fills the fields, ticks the consent box and submits →
      "Signed & submitted" → status Submitted.
- [x] When the employee submits without ticking consent → "Please confirm that you agree to sign electronically."
- [x] When the employee clicks Reject → the reason dialog; with a short reason → "Reason must be at least 10
      characters"; with a valid reason → "Contract rejected" → status Rejected.
- [x] When the contract has expired → "This contract has expired. Contact HR for a new one." and it can't be signed;
      when it was revoked → "This contract was withdrawn by HR."
- [x] When the employee double-clicks Submit → it is signed once.
- [x] When the employee downloads → the PDF (watermarked "Not final" until completed).
- [x] When the owner opens My Requests → Contracts → the same behaviour for the owner's own contracts.
- [x] When the employee opens `/employee/my-contracts?contract=<id>` (the email link), or the owner opens
      `/admin/my-requests/contracts?contract=<id>` → that contract opens.
- [x] When lint runs → it passes.
