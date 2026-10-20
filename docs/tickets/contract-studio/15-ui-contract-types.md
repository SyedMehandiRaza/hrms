# 15: Contract Types screen

**What to build:** `/admin/contract-types` shows real contract types with search and status filter; the existing
modal creates, views and edits; delete works with confirmation.

**Blocked by:** 03 Contract types API

**Status:** ready-for-agent

Verified by the ui-tester agent:

- [ ] When HR opens the screen → a loading state, then the list; searching and the active/inactive filter change
      the rows; with no types → the empty state.
- [ ] When HR creates "Extension" with code "ext" → "Contract Type Created" → the row shows code "EXT".
- [ ] When HR saves invalid fields → the messages appear under the inputs exactly as standards §7.3 "Contract type".
- [ ] When HR saves a duplicate name → "A contract type with this name already exists."; a duplicate code → "A
      contract type with this code already exists."
- [ ] When HR edits a type → "Contract type updated successfully" and the row updates.
- [ ] When HR deletes a used type → "This contract type is in use and can't be deleted. Deactivate it instead.";
      an unused one → it disappears.
- [ ] When a sub-admin without create, update or delete opens the screen → those buttons aren't shown.
- [ ] When loading fails → an error state with the server message and Retry.
- [ ] When lint runs → it passes.
