# 13: Designations API

**What to build:** Create, list, edit and delete designations inside a department; plus a dropdown list for
later screens (D32, D33, D37).

**Blocked by:** 12 Departments API

**Status:** done

- [x] A department's designations list paginates, searches and filters by status.
- [x] The dropdown list returns only active designations of active departments, optionally for one department.
- [x] "Engineer" in two departments → both allowed; "engineer" twice in one department → 409
      `DESIGNATION_NAME_TAKEN` "A designation with this name already exists in this department."
- [x] The same code in two departments of one company → 409 `DESIGNATION_CODE_TAKEN`
      "A designation with this code already exists."; no code at all is allowed.
- [x] Field errors under each field: "Designation Name is required",
      "Designation Name must be at least 2 characters", "Designation Name cannot exceed 150 characters",
      "Designation Name cannot contain emojis", "Designation Code cannot exceed 50 characters",
      "Designation Code cannot contain emojis", "Description cannot exceed 2000 characters",
      "Description cannot contain emojis".
- [x] Editing can't move a designation to another department (the department stays the same).
- [x] Deleting with any linked employee → 409 `DESIGNATION_IN_USE`
      "This designation has employees and can't be deleted."; otherwise deleted and the name is reusable.
- [x] Another company's department or designation → 404; a missing role flag → 403.
