# 05: Templates and merge-field catalogue API

**What to build:** Create, list, view, edit, duplicate, archive and delete templates with placed fields, and serve
the fixed merge-field catalogue (plan decisions 9–14, 44).

**Blocked by:** 03 Contract types API, 04 Contract documents API

**Status:** ready-for-agent

- [ ] When HR asks for the catalogue for EMPLOYEE → the Employee and Contract groups; for STAFFING_COMPANY → the
      Staffing Company and Contract groups.
- [ ] When HR asks for the catalogue for VENDOR, CLIENT or COLLABORATING_COMPANY → 400 / "Only Employee and
      Staffing Company contracts are available right now."
- [ ] When HR saves a template with a name, a saved (not archived) document, an active type and a SIGNATURE field → it is
      ACTIVE with all its fields, positions and required flags.
- [ ] When HR saves without a name → "Give the template a name."; with 256 characters → "Template name cannot
      exceed 255 characters".
- [ ] When HR saves without a document → "Select a source document first."; with an archived one → 409 / "This
      document is archived and can't be used for templates."
- [ ] When HR saves with no fields → "Add at least one field or column."; with fields but no SIGNATURE → "Add at
      least one signature field."
- [ ] When the only SIGNATURE field is optional → "Add at least one signature field."
- [ ] When a field has width or height below 0.01, a negative position, or x + width (or y + height) above 1 →
      "Fields must sit inside the page."
- [ ] When a label has 161 characters → "Label cannot exceed 160 characters"; when it is empty → the catalogue label
      (merge field) or the type name is stored.
- [ ] When HR saves 201 fields → "A template can have at most 200 fields"; with 200 → saved.
- [ ] When HR saves 21 SIGNATURE and INITIALS fields in total → "A template can have at most 20 signature and
      initials fields"; with 20 → saved.
- [ ] When HR saves a field outside its page, or on a page the document doesn't have → "Fields must sit inside the page."
- [ ] When HR saves without a type, or with an inactive one → "Choose a contract type".
- [ ] When HR uses a merge token from another audience, or one that doesn't exist → "Unknown merge field".
- [ ] When HR creates or edits a template with audience VENDOR, CLIENT or COLLABORATING_COMPANY → 400 / "Only
      Employee and Staffing Company contracts are available right now."
- [ ] When HR changes an Employee template to Staffing Company and it still has an Employee merge field →
      "Unknown merge field"; with only Contract-group merge fields → saved.
- [ ] When HR edits a template that already has contracts → the change saves, and the existing contracts' fields
      stay unchanged.
- [ ] When HR duplicates a template → a new ACTIVE template "<name> (copy)" with the same fields.
- [ ] When HR archives a template → it drops out of the active list and is kept for history.
- [ ] When HR unarchives a template → it is ACTIVE again; when its document is archived → 409 / "This document is
      archived and can't be used for templates."; when its type is inactive → "Choose a contract type".
- [ ] When HR edits a template whose document was archived after it was built → 409 / "This document is archived
      and can't be used for templates."
- [ ] When HR deletes a template used by a contract → 409 / "This template is used by contracts and can't be
      deleted. Archive it instead."
- [ ] When HR deletes an unused template → it is gone.
- [ ] When HR opens another company's template → 404 / "The requested record was not found."
- [ ] When a sub-admin without the matching flag, the employee or the staffing company makes a call → 403 /
      "You don't have permission to do this."
