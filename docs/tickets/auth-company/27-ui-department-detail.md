# 27: Department detail and designations screen

**What to build:** `/admin/departments/:id` shows the real department and manages its designations with the
existing modal (D32).

**Blocked by:** 26 Departments list screen, 13 Designations API

**Status:** done

Verified by the ui-tester agent:

- [x] Loading state, then code, head, created date, total employees and the designations table.
- [x] No designations → the empty state.
- [x] Create "Engineer" → "Designation created successfully"; creating "Engineer" in another department also
      succeeds; "engineer" again in this department → "A designation with this name already exists in this
      department."
- [x] A code already used elsewhere in the company → "A designation with this code already exists."
- [x] Field errors under the inputs: "Designation Name is required",
      "Designation Name must be at least 2 characters", "Designation Name cannot exceed 150 characters",
      "Designation Name cannot contain emojis", "Designation Code cannot exceed 50 characters",
      "Designation Code cannot contain emojis", "Description cannot exceed 2000 characters",
      "Description cannot contain emojis".
- [x] Edit → "Designation updated successfully"; delete with employees → "This designation has employees and can't
      be deleted."; unused → removed.
- [x] Unknown or another company's department id → "The requested record was not found."
- [x] A user without designation permissions doesn't see the add/edit/delete buttons.
- [x] Lint passes.
