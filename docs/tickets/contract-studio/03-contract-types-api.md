# 03: Contract types API

**What to build:** List, create, edit, deactivate and delete company contract types (plan decisions 15–17).

**Blocked by:** 01 Contract schema changes, 02 Contract Studio messages

**Status:** done

- [x] When HR lists contract types → paginated results; searching matches name or code; the filter shows active or
      inactive types.
- [x] When HR creates "Extension" with code "ext" → 201, and the code is stored as "EXT".
- [x] When HR creates "extension" while "Extension" exists → 409 / "A contract type with this name already exists."
- [x] When HR creates a type with a code already in use → 409 / "A contract type with this code already exists."
- [x] When HR in another company creates the same name and code → 201.
- [x] When HR saves invalid fields → 400 / "Please fix the highlighted fields." with, as applicable:
      "Contract Type Name is required", "Name must be at least 2 characters", "Name cannot exceed 150 characters",
      "Code is required", "Code must be at least 2 characters", "Code cannot exceed 100 characters",
      "Description cannot exceed 500 characters", "Emojis are not allowed".
- [x] When HR deactivates a type → it is inactive; templates already using it keep working.
- [x] When HR deletes a type used by a template or contract → 409 / "This contract type is in use and can't be
      deleted. Deactivate it instead."
- [x] When HR deletes an unused type → its row is removed (hard delete), and a new type with the same name and code
      can then be created.
- [x] When HR opens, edits or deletes another company's type → 404 / "The requested record was not found."
- [x] When a sub-admin without `contract:read/create/update/delete` makes the matching call → 403 / "You don't have
      permission to do this."
- [x] When the employee or the staffing company makes any call → 403 / "You don't have permission to do this."
- [x] When the owner makes any call → allowed, with or without a role.
