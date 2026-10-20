# 10: Sign (submit)

**What to build:** Submit with fields, signatures and consent, capturing write-once evidence; safety against double
submits and races (plan decisions 29, 31–32, 37). Reject is ticket 24.

**Blocked by:** 09 Signer inbox API

**Status:** done

- [x] When the employee submits every required field, a drawn or typed signature and consent → the contract and
      recipient become SUBMITTED, evidence is stored once (profile name, account, user and employee ids, UTC time,
      IP, user agent, consent text v1, template PDF hash, values hash), and a SIGNED activity is logged.
- [x] When the staffing company submits its own contract → the same, with the staffing company id in the evidence.
- [x] When the evidence is stored → it holds each drawn image's SHA-256 (matching the stored file), the document's
      stored hash, and a values hash that the shared recipe reproduces from the stored values.
- [x] When the request comes through a trusted proxy with an `X-Forwarded-For` client address → that address is
      recorded as the signer's IP.
- [x] When the employee submits without consent → 400 / "Please confirm that you agree to sign electronically."
- [x] When a required field is empty → 400 / "Please fix the highlighted fields." with "This field is required"
      under that field id.
- [x] When a DATE field isn't a real date → "Enter a valid date (YYYY-MM-DD)".
- [x] When a typed signature has 1 or 101 characters → "Signature must be 2–100 characters"; with an emoji →
      "Emojis are not allowed".
- [x] When typed initials have 1 character → accepted; 11 characters → "Initials must be 1–10 characters"; an emoji
      → "Emojis are not allowed".
- [x] When a signature value is neither `{ type: "DRAWN", dataUrl }` nor `{ type: "TYPED", text }` → "Signature
      image is invalid or too large".
- [x] When an input has 501 characters → "This field cannot exceed 500 characters"; an emoji → "Emojis are not
      allowed".
- [x] When a required checkbox is `false` → "This field is required"; an optional one `false` → accepted.
- [x] When the body includes unknown field ids or a merge field's id → they are ignored and the merge value is
      unchanged.
- [x] When an optional field is left empty → accepted and nothing is stamped for it.
- [x] When a drawn signature isn't a PNG (checked by its bytes) or its decoded image is over 500 KB → "Signature
      image is invalid or too large".
- [x] When the employee submits 20 drawn signatures of 500 KB each → accepted (the body is over 1 MB).
- [x] When the submit body is over 15 MB → 413 / "The request is too large."
- [x] When the typed signature differs from the profile name → accepted, and the profile name is still recorded.
- [x] When saving fails after the signature images were written (forced in the test) → 500 / "Something went
      wrong. Please try again.", the contract is unchanged and no image file is left behind.
- [x] When the employee submits twice, or two submits run at once → one signature is stored; the other gets 409 /
      "You have already signed this contract."
- [x] When the sign-by date has passed (even before the job runs) → 409 / "This contract has expired. Contact HR
      for a new one.", and the contract is now EXPIRED with an EXPIRED activity.
- [x] When HR has revoked it → 409 / "This contract was withdrawn by HR."
- [x] When it is COMPLETED → 409 / "You have already signed this contract."
- [x] When it is REJECTED → 409 / "This contract can no longer be changed."
- [x] When the signer has become inactive (for a staffing company: including its login's account ending, e.g. while
      a session is still open) → 409 / "This recipient is no longer active."
- [x] When an expired contract is submitted without consent and with empty required fields → 409 / "This contract
      has expired. Contact HR for a new one." (state is checked before the body).
- [x] When a signature is saved → no profile signature column on employees or staffing companies changes.
- [x] When anyone other than the contract's signer submits it (another employee, the staffing company for a supplied
      employee's contract, the employee for a staffing contract, HR or the owner) → 404 / "The requested record was
      not found." and nothing changes.
