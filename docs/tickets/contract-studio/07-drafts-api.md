# 07: Drafts API (create, edit, delete)

**What to build:** Creating drafts (one per recipient) with the term rules, editing a draft's name and terms, and
deleting drafts (plan decisions 18–22, 25, 42). Listing, detail, stats and the draft preview are ticket 23.

**Blocked by:** 05 Templates and merge-field catalogue API, 06 Recipient lookup API

**Status:** done

- [x] When HR saves a draft for 3 recipients → 3 DRAFT contracts, each with no number, one PRIMARY_SIGNER
      recipient, a copy of the template's fields, the template's contract type and a CREATED activity.
- [x] When HR saves with no template → "Pick a template to continue."; with no recipients → "Select at least one
      recipient."; with an archived template → 409 / "This template is archived. Choose an active template."
- [x] When HR saves drafts from a template whose audience is VENDOR (inserted directly into the database) → 400 /
      "Only Employee and Staffing Company contracts are available right now."
- [x] When HR saves drafts from an Employee template → each contract's audience is EMPLOYEE (no audience is sent).
- [x] When HR picks 201 recipients → 400 / "You can send to at most 200 recipients at a time."
- [x] When one recipient id doesn't exist, belongs to another company, or is from the other audience → 404 / "The
      requested record was not found." and no draft is created for anyone.
- [x] When the same recipient id is given twice → one draft is created for it.
- [x] When HR leaves out the start date → "Start date is required"; when a date isn't real → "Enter a valid date (YYYY-MM-DD)".
- [x] When HR enters a start date in the past → accepted.
- [x] When the end date is before the start → "End date must be on or after the start date"; when it is before
      today (company time) → "End date can't be in the past".
- [x] When renewal due is before the start or after the end → "Renewal due must be between the start and end dates".
- [x] When sign-by is today or more than 90 days away → "Sign-by date must be between tomorrow and 90 days from
      today"; when it is left out → it defaults to today + 7.
- [x] When the rate is 0, negative or has 3 decimals → "Rate must be a positive amount with up to 2 decimals"; when
      a rate is given without a unit → "Choose how the rate is paid".
- [x] When the currency isn't in the supported list → "Choose a valid currency"; when it is left out → SAR.
- [x] When the notice period is −1 or 366 → "Notice period must be 0–365 days".
- [x] When the name has 256 characters → "Contract name cannot exceed 255 characters"; when it is left out → the
      template's name is used.
- [x] When HR edits a draft's name and terms → saved, with an UPDATED activity listing old → new values.
- [x] When HR sends a template or recipient in a draft edit → those keys are ignored (stripped), the edit saves with
      200, and the draft keeps its template and recipient.
- [x] When HR edits or deletes a non-draft → 409 / "This contract can no longer be changed."
- [x] When HR deletes a draft → it is soft-deleted and its activity rows are kept.
- [x] When HR edits or deletes another company's draft → 404 / "The requested record was not found."
- [x] When a sub-admin without `contract:create` saves drafts, without `contract:update` edits one, or without
      `contract:delete` deletes one → 403 / "You don't have permission to do this."
