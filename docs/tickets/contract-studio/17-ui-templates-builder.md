# 17: Templates list and builder

**What to build:** `/admin/new-contracts/templates` and `/templates/build` work against the API: real PDF pages,
placed fields, merge fields from the catalogue, contract type on save (plan decisions 9–16, 45).

**Blocked by:** 05 Templates and merge-field catalogue API, 16 Documents screen

**Status:** done

Verified by the ui-tester agent:

- [x] When HR opens the builder with a document → its real pages render.
- [x] When HR drags Text Input, Checkbox, Date, Initials, Signature and a merge field onto a page and saves → after
      reload every field is in the same place with the same settings.
- [x] When HR opens the merge-field list for an Employee template → the Employee and Contract groups; for a
      Staffing template → the Staffing Company and Contract groups.
- [x] When HR saves with a name and a Contract type → "Template saved" → it is listed as active.
- [x] When HR saves without a name → "Give the template a name."; without a document → "Select a source document
      first."; with no fields → "Add at least one field or column."; with no signature field → "Add at least one
      signature field."; without a type → "Choose a contract type"; with more than 20 signature and initials
      fields → "A template can have at most 20 signature and initials fields".
- [x] When HR captures a sample signature → "Signature captured".
- [x] When HR duplicates a template → "Template duplicated" and a "(copy)" row appears.
- [x] When HR archives a template → it no longer appears in the send wizard.
- [x] When HR deletes a used template → "This template is used by contracts and can't be deleted. Archive it
      instead."; an unused one → "Template deleted".
- [x] When a sub-admin without the matching flags opens the screens → create, edit and delete actions aren't shown.
- [x] When lint runs → it passes.
